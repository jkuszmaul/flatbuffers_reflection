import { Builder, ByteBuffer } from "flatbuffers";
import { Parser, Table } from "./reflection";
import { BaseType, EnumVal, Field, Schema, Type } from "./reflection_generated";
import { ByteVector, NestedStruct } from "./test/ByteVector";
import { Equipment, Monster, MonsterT, ShieldT } from "./test/Union";
import { readFileSync } from "fs";

describe("parseReflectionSchema", () => {
  it("Reads reflection table", () => {
    // Set up a test where we use the schema of the Schema type itself to test
    // the reflection library, because in practice the Schema type has ~all of
    // the interesting features that we support reflection for.
    const reflectionSchemaBuffer: Buffer = readFileSync(`${__dirname}/reflection.bfbs`);
    const reflectionSchemaByteBuffer: ByteBuffer = new ByteBuffer(reflectionSchemaBuffer);
    const schema = Schema.getRootAsSchema(reflectionSchemaByteBuffer);
    const parser = new Parser(schema);
    const table = Table.getRootTable(reflectionSchemaByteBuffer);
    const schemaObject = parser.toObject(table);
    // Spot-check some individual features of the reflection schema. This
    // covers testing that we can read vectors of tables.
    expect(schemaObject["objects"].length).toEqual(schema.objectsLength());
    expect(schemaObject["objects"].length).toEqual(10);
    expect(schemaObject["objects"][0]["name"]).toEqual("reflection.Enum");
    expect(schemaObject["file_ident"]).toEqual("BFBS");
    expect(schemaObject["file_ext"]).toEqual("bfbs");
    expect(schemaObject["fbs_files"][0]["filename"].substr(-14)).toEqual("reflection.fbs");
    expect(schemaObject["fbs_files"][0]["included_filenames"].length).toEqual(0);

    // Test constructing a small object that specifically lets us exercise
    // some edge cases that the actual schema doesn't. Covered reflection
    // features:
    // * Reading numbers & BigInt's
    // * Vectors of strings
    // * Table fields
    // * Default scalars
    {
      const builder = new Builder();
      const docOffsets = [builder.createString("abc"), builder.createString("def")];
      const docVector = EnumVal.createDocumentationVector(builder, docOffsets);
      const nameOffset = builder.createString("name");
      Type.startType(builder);
      Type.addBaseType(builder, BaseType.Int);
      Type.addIndex(builder, 123);
      const typeOffset = Type.endType(builder);
      EnumVal.startEnumVal(builder);
      EnumVal.addName(builder, nameOffset);
      // Make sure that we are testing an integer that will exceed the normal
      // precision bounds.
      EnumVal.addValue(builder, BigInt(Number.MAX_SAFE_INTEGER) + 2n);
      EnumVal.addDocumentation(builder, docVector);
      EnumVal.addUnionType(builder, typeOffset);
      builder.finish(EnumVal.endEnumVal(builder));
      const array = builder.asUint8Array();
      const fbBuffer = new ByteBuffer(array);

      const enumTable = Table.getNamedTable(fbBuffer, schema, "reflection.EnumVal");
      expect(parser.toObject(enumTable)).toEqual({
        documentation: ["abc", "def"],
        name: "name",
        union_type: {
          base_type: 7,
          index: 123,
        },
        value: 9007199254740993n,
      });
      expect(parser.readScalar(enumTable, "value", false)).toBe(
        BigInt(Number.MAX_SAFE_INTEGER) + 2n,
      );
      const typeFb = parser.readTable(enumTable, "union_type");
      if (typeFb === null) {
        throw new Error();
      }
      expect(parser.readScalar(typeFb, "index", false)).toBe(123);
      // Confirm that readDefaults works.
      expect(parser.readScalar(typeFb, "base_size", true)).toBe(4);
      expect(parser.readScalar(typeFb, "base_size", false)).toBe(null);
    }
    {
      const builder = new Builder();
      Type.startType(builder);
      Type.addBaseType(builder, BaseType.Int);
      const typeOffset = Type.endType(builder);
      const nameOffset = builder.createString("name");
      Field.startField(builder);
      Field.addName(builder, nameOffset);
      Field.addType(builder, typeOffset);
      Field.addOptional(builder, true);
      builder.finish(Field.endField(builder));
      const array = builder.asUint8Array();
      const fbBuffer = new ByteBuffer(array);

      const fieldTable = Table.getNamedTable(fbBuffer, schema, "reflection.Field");
      expect(parser.readScalar(fieldTable, "deprecated", false)).toBe(null);
      expect(parser.readScalar(fieldTable, "deprecated", true)).toBe(false);
      expect(parser.readScalar(fieldTable, "optional")).toBe(true);
      expect(parser.readScalar(fieldTable, "default_integer", false)).toBe(null);
      expect(parser.readScalar(fieldTable, "default_integer", true)).toBe(0n);
      expect(parser.readScalar(fieldTable, "default_real", false)).toBe(null);
      expect(parser.readScalar(fieldTable, "default_real", true)).toBe(0);
      expect(parser.readScalar(fieldTable, "padding", false)).toBe(null);
      expect(parser.readScalar(fieldTable, "padding", true)).toBe(0);
    }
  });
  it.only("supports union types", () => {
    const schemaBuffer: Buffer = readFileSync(`${__dirname}/test/Union.bfbs`);
    const schemaByteBuffer: ByteBuffer = new ByteBuffer(schemaBuffer);
    const schema = Schema.getRootAsSchema(schemaByteBuffer);

    const monster = new MonsterT();
    monster.equipped = new ShieldT();
    monster.equipped.protection = 27.3;
    monster.equippedType = Equipment.Shield;

    const builder = new Builder();
    Monster.finishMonsterBuffer(builder, monster.pack(builder));

    const parser = new Parser(schema);
    const table = Table.getRootTable(new ByteBuffer(builder.asUint8Array()));
    const schemaObject = parser.toObject(table);

    console.log(schemaObject);
    expect(schemaObject).toEqual({ equipped: { protection: 27 } });
  });
  it("converts uint8 vectors to uint8arrays", () => {
    const builder = new Builder();
    const data = ByteVector.createDataVector(builder, [1, 2, 3]);
    ByteVector.startByteVector(builder);
    ByteVector.addData(builder, data);
    const byteVector = ByteVector.endByteVector(builder);
    builder.finish(byteVector);
    // the underlying buffer for the builder is larger than the uint8array of the data
    // this needs to be cleared so that the reading from the buffer by the parser doesn't use the wrong offsets
    // normally when this is written to a file, only the contents of the Uint8Array are written, not the underlying buffer
    // so this replicates that
    // essentially need to make sure byteVectorBB.bytes().buffer !== builder.asUint8Array().buffer
    const byteVectorBB = new ByteBuffer(Uint8Array.from(builder.asUint8Array()));

    const byteVectorSchemaByteBuffer = new ByteBuffer(
      readFileSync(`${__dirname}/test/ByteVector.bfbs`),
    );
    const rawSchema = Schema.getRootAsSchema(byteVectorSchemaByteBuffer);
    const parser = new Parser(rawSchema);
    const table = Table.getNamedTable(byteVectorBB, rawSchema, "ByteVector");
    const byteVectorObject = parser.toObject(table);
    expect(byteVectorObject["data"]).toEqual(new Uint8Array([1, 2, 3]));
  });
  it("reads flatbuffer structs", () => {
    const builder = new Builder();
    const struct = NestedStruct.createNestedStruct(builder, 971);
    ByteVector.startByteVector(builder);
    ByteVector.addNestedStruct(builder, struct);
    const byteVector = ByteVector.endByteVector(builder);
    builder.finish(byteVector);
    const byteVectorBB = new ByteBuffer(Uint8Array.from(builder.asUint8Array()));

    const byteVectorSchemaByteBuffer = new ByteBuffer(
      readFileSync(`${__dirname}/test/ByteVector.bfbs`),
    );
    const rawSchema = Schema.getRootAsSchema(byteVectorSchemaByteBuffer);
    const parser = new Parser(rawSchema);
    const table = Table.getNamedTable(byteVectorBB, rawSchema, "ByteVector");
    const byteVectorObject = parser.toObject(table);
    expect(byteVectorObject).toEqual({ nested_struct: { a: 971 } });
  });
  it("converts uint8 vectors to uint8arrays in an offset Uint8Array source", () => {
    const builder = new Builder();
    const data = ByteVector.createDataVector(builder, [1, 2, 3]);
    ByteVector.startByteVector(builder);
    ByteVector.addData(builder, data);
    const byteVector = ByteVector.endByteVector(builder);
    builder.finish(byteVector);
    const paddingLength = 10;
    const backingBuffer = new Uint8Array(builder.asUint8Array().length + paddingLength);
    backingBuffer.set(new Array(paddingLength).fill(0));
    backingBuffer.set(builder.asUint8Array(), paddingLength);
    const byteVectorBB = new ByteBuffer(
      new Uint8Array(backingBuffer.buffer, paddingLength, backingBuffer.length - paddingLength),
    );
    const byteVectorSchemaByteBuffer = new ByteBuffer(
      readFileSync(`${__dirname}/test/ByteVector.bfbs`),
    );
    const rawSchema = Schema.getRootAsSchema(byteVectorSchemaByteBuffer);
    const parser = new Parser(rawSchema);
    const table = Table.getNamedTable(byteVectorBB, rawSchema, "ByteVector");
    const byteVectorObject = parser.toObject(table);
    expect(byteVectorObject["data"]).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects invalid table offsets and vtables", () => {
    expect(() => Table.getRootTable(new ByteBuffer(new Uint8Array([6, 0, 0])))).toThrow(
      "Attempt to parse root table offset from 0, which would extend beyond ByteBuffer (capacity 3)",
    );

    expect(() => Table.getRootTable(new ByteBuffer(new Uint8Array([255, 255, 255, 255])))).toThrow(
      "Attempt to construct Table with offset 4294967295, which would extend beyond ByteBuffer (capacity 4)",
    );

    expect(() =>
      Table.getRootTable(new ByteBuffer(new Uint8Array([6, 0, 0, 0, 0, 0, 0, 0]))),
    ).toThrow(
      "Attempt to construct Table with offset 6, which would extend beyond ByteBuffer (capacity 8)",
    );

    expect(() =>
      Table.getRootTable(new ByteBuffer(new Uint8Array([4, 0, 0, 0, 5, 0, 0, 0]))),
    ).toThrow(
      "Table at offset 4 points to vtable at -1 (4 - 5), which would extend beyond the ByteBuffer (capacity 8)",
    );

    expect(() =>
      Table.getRootTable(new ByteBuffer(new Uint8Array([4, 0, 0, 0, 255, 255, 255, 255]))),
    ).toThrow(
      "Table at offset 4 points to vtable at 5 (4 - -1), which would extend beyond the ByteBuffer (capacity 8)",
    );

    expect(() =>
      Table.getRootTable(
        new ByteBuffer(new Uint8Array([4, 0, 0, 0, 252, 255, 255, 255, 3, 0, 0, 0])),
      ),
    ).toThrow(
      "Table at offset 4 points to vtable at 8 (4 - -4), which specifies vtable size 3, which should be at least 4 (vtable size + object size)",
    );

    expect(() =>
      Table.getRootTable(
        new ByteBuffer(new Uint8Array([4, 0, 0, 0, 252, 255, 255, 255, 5, 0, 0, 0])),
      ),
    ).toThrow(
      "Table at offset 4 points to vtable at 8 (4 - -4), which specifies vtable size 5, which would extend beyond the ByteBuffer (capacity 12)",
    );

    expect(() =>
      Table.getRootTable(
        new ByteBuffer(new Uint8Array([4, 0, 0, 0, 252, 255, 255, 255, 4, 0, 1, 0])),
      ),
    ).toThrow(
      "Table at offset 4 points to vtable at 8 (4 - -4), which specifies inline object size 1, which should be at least 4 (vtable offset)",
    );

    expect(() =>
      Table.getRootTable(
        new ByteBuffer(new Uint8Array([4, 0, 0, 0, 252, 255, 255, 255, 4, 0, 9, 0])),
      ),
    ).toThrow(
      "Table at offset 4 points to vtable at 8 (4 - -4), which specifies inline object size 9, which would extend beyond the ByteBuffer (capacity 12)",
    );

    expect(() =>
      Table.getRootTable(
        new ByteBuffer(new Uint8Array([4, 0, 0, 0, 252, 255, 255, 255, 4, 0, 8, 0])),
      ),
    ).not.toThrow();
  });

  it("performs bounds checking for scalars", () => {
    const reflectionSchemaBuffer = readFileSync(`${__dirname}/reflection.bfbs`);
    const schema = Schema.getRootAsSchema(new ByteBuffer(reflectionSchemaBuffer));
    const parser = new Parser(schema);

    const builder = new Builder();
    const docOffsets = [builder.createString("abc"), builder.createString("def")];
    const docVector = EnumVal.createDocumentationVector(builder, docOffsets);
    const nameOffset = builder.createString("name");
    Type.startType(builder);
    Type.addBaseType(builder, BaseType.Int);
    Type.addIndex(builder, 123);
    const typeOffset = Type.endType(builder);
    EnumVal.startEnumVal(builder);
    EnumVal.addName(builder, nameOffset);
    EnumVal.addValue(builder, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
    EnumVal.addDocumentation(builder, docVector);
    EnumVal.addUnionType(builder, typeOffset);
    builder.finish(EnumVal.endEnumVal(builder));
    const array = builder.asUint8Array();

    array[12] = 255;
    const fbBuffer = new ByteBuffer(array);

    const reflectionFb = Table.getNamedTable(fbBuffer, schema, "reflection.EnumVal");
    expect(() => parser.toObject(reflectionFb)).toThrow(
      "Attempt to read scalar type 9 (size 8) at offset 275, which would extend beyond ByteBuffer (capacity 112)",
    );
  });
});

// Finally, to cover some things not covered by the reflection schema we use
// the typescript_keywords things. We can't actually use monster_test.fbs
// because it attempts to do a circular include, which the typescript flat-file
// codegen doesn't support.
// This covers:
// * Structs
// * Vectors of structs
// * Vectors of numbers
//{
//  const builder = new Builder();
//
//  TestObject.startStructuresVector(builder, 2);
//  // Note: because the builder builds top-down, we write these in reverse order.
//  typeof_.createtypeof(
//      builder, 3.125, 2, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(2));
//  typeof_.createtypeof(
//      builder, 3.125, 2, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
//  const structVector = builder.endVector();
//
//  const constVector =
//      TestObject.createConstVector(builder, [BigInt(1), BigInt(2), BigInt(3)]);
//
//  TestObject.startObject(builder);
//  TestObject.addStructure(
//      builder, typeof_.createtypeof(builder, 1.0625, 3, BigInt(3)));
//  TestObject.addStructures(builder, structVector);
//  TestObject.addConst(builder, constVector);
//
//  builder.finish(TestObject.endObject(builder));
//
//  const array = builder.asUint8Array();
//  const fbBuffer = new ByteBuffer(array);
//
//  const schemaBuffer: ByteBuffer =
//      new ByteBuffer(readFileSync('tests/typescript_keywords.bfbs'));
//  const schema = Schema.getRootAsSchema(schemaBuffer);
//  const reflectionFb =
//      Table.getNamedTable(fbBuffer, schema, 'typescript.Object');
//  const parser = new Parser(schema);
//  assertEqual(
//      '{"const":["1","2","3"],"structure":{"x":1.0625,"y":3,"z":"3"},"structures":[{"x":3.125,"y":2,"z":"9007199254740992"},{"x":3.125,"y":2,"z":"9007199254740993"}]}',
//      stringify(parser.toObject(reflectionFb)));
//}
