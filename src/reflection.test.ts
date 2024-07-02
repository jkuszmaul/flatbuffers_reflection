/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Builder, ByteBuffer } from "flatbuffers";
import { readFileSync } from "fs";

import { Parser, Table } from "./reflection";
import {
  ArraysTable,
  ArraysTableT,
  Color,
  Mat3x3bT,
  Mat3x3dT,
  Mat3x3eT,
  Mat3x3fT,
  Mat3x3iT,
  Mat3x3lT,
  Mat3x3sT,
  Point3bT,
  Point3dT,
  Point3eT,
  Point3fT,
  Point3iT,
  Point3lT,
  Point3sT,
} from "./test/gen/ArraysTable";
import { ByteVector, NestedStruct } from "./test/gen/ByteVector";
import { ArmsT } from "./test/gen/arms";
import { Equipment } from "./test/gen/equipment";
import { GemstoneT } from "./test/gen/gemstone";
import { Kind } from "./test/gen/kind";
import { Monster, MonsterT } from "./test/gen/monster";
import { ShieldT } from "./test/gen/shield";
import { ShieldDecorator } from "./test/gen/shield-decorator";
import { SkullT } from "./test/gen/skull";
import { StructBT } from "./test/gen/struct-b";
import { UnionStruct, UnionStructT } from "./test/gen/union-struct";
import { BaseType, EnumVal, Field, Schema, Type } from "./vendor/gen/reflection";

describe("parseReflectionSchema", () => {
  it("Reads reflection table", () => {
    // Set up a test where we use the schema of the Schema type itself to test
    // the reflection library, because in practice the Schema type has ~all of
    // the interesting features that we support reflection for.
    const reflectionSchemaBuffer: Buffer = readFileSync(`${__dirname}/vendor/gen/reflection.bfbs`);
    const reflectionSchemaByteBuffer: ByteBuffer = new ByteBuffer(reflectionSchemaBuffer);
    const schema = Schema.getRootAsSchema(reflectionSchemaByteBuffer);
    const parser = new Parser(schema);
    const table = Table.getRootTable(reflectionSchemaByteBuffer);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    const schemaObject = parser.toObject(table) as any;
    // Spot-check some individual features of the reflection schema. This
    // covers testing that we can read vectors of tables.
    expect(schemaObject["objects"].length).toEqual(schema.objectsLength());
    expect(schemaObject["objects"].length).toEqual(10);
    expect(schemaObject["objects"][0]!["name"]).toEqual("reflection.Enum");
    expect(schemaObject["file_ident"]).toEqual("BFBS");
    expect(schemaObject["file_ext"]).toEqual("bfbs");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
      if (typeFb == null) {
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
  it("reads fields in order of id", () => {
    const reflectionSchemaBuffer: Buffer = readFileSync(`${__dirname}/vendor/gen/reflection.bfbs`);
    const reflectionSchemaByteBuffer: ByteBuffer = new ByteBuffer(reflectionSchemaBuffer);
    const schema = Schema.getRootAsSchema(reflectionSchemaByteBuffer);
    const parser = new Parser(schema);
    const table = Table.getRootTable(reflectionSchemaByteBuffer);
    const schemaObject = parser.toObject(table);
    expect(Object.keys(schemaObject)).toEqual([
      "objects",
      "enums",
      "file_ident",
      "file_ext",
      "root_table",
      "services",
      "fbs_files",
    ]);
  });
  it("supports union types", () => {
    const schemaBuffer: Buffer = readFileSync(`${__dirname}/test/gen/Union.bfbs`);
    const schemaByteBuffer: ByteBuffer = new ByteBuffer(schemaBuffer);
    const schema = Schema.getRootAsSchema(schemaByteBuffer);

    const monster = new MonsterT();

    monster.equippedType = Equipment.Shield;
    monster.equipped = new ShieldT();
    monster.equipped.protection = 27.5;
    monster.equipped.primaryDecorator = new ArmsT(12);
    monster.equipped.primaryDecoratorType = ShieldDecorator.Arms;

    monster.equipped.decorators.push(new GemstoneT(1.02337));
    monster.equipped.decorators.push(new SkullT("some-name"));
    monster.equipped.decoratorsType.push(ShieldDecorator.Gemstone);
    monster.equipped.decoratorsType.push(ShieldDecorator.Skull);

    const builder = new Builder();
    Monster.finishMonsterBuffer(builder, monster.pack(builder));

    const parser = new Parser(schema);
    const table = Table.getRootTable(new ByteBuffer(builder.asUint8Array()));
    const schemaObject = parser.toObject(table);

    expect(schemaObject).toEqual({
      equipped_type: Equipment.Shield,
      equipped: {
        protection: 27.5,
        primary_decorator: { count: 12 },
        primary_decorator_type: ShieldDecorator.Arms,
        decorators: [{ shine: 1.02337 }, { name: "some-name" }],
        decorators_type: [ShieldDecorator.Gemstone, ShieldDecorator.Skull],
      },
    });
  });
  it("supports union NONE", () => {
    const schemaBuffer: Buffer = readFileSync(`${__dirname}/test/gen/Union.bfbs`);
    const schemaByteBuffer: ByteBuffer = new ByteBuffer(schemaBuffer);
    const schema = Schema.getRootAsSchema(schemaByteBuffer);

    const monster = new MonsterT();

    monster.equippedType = Equipment.Shield;
    monster.equipped = new ShieldT();
    monster.equipped.protection = -27.5;
    monster.equipped.primaryDecoratorType = ShieldDecorator.NONE;

    monster.equipped.decorators.push(new GemstoneT(1.02337));
    monster.equipped.decoratorsType.push(ShieldDecorator.NONE);

    const builder = new Builder();
    Monster.finishMonsterBuffer(builder, monster.pack(builder));

    const parser = new Parser(schema);
    const table = Table.getRootTable(new ByteBuffer(builder.asUint8Array()));
    const schemaObject = parser.toObject(table);

    expect(schemaObject).toEqual({
      equipped_type: Equipment.Shield,
      equipped: {
        protection: -27.5,
        primary_decorator: undefined,
        decorators: [undefined],
        decorators_type: [ShieldDecorator.NONE],
      },
    });
  });
  it("supports union of struct", () => {
    const schemaBuffer: Buffer = readFileSync(`${__dirname}/test/gen/UnionStruct.bfbs`);
    const schemaByteBuffer: ByteBuffer = new ByteBuffer(schemaBuffer);
    const schema = Schema.getRootAsSchema(schemaByteBuffer);

    const unionStruct = new UnionStructT();

    unionStruct.kind = new StructBT(3);
    unionStruct.kindType = Kind.StructB;

    const builder = new Builder();
    UnionStruct.finishUnionStructBuffer(builder, unionStruct.pack(builder));

    const parser = new Parser(schema);
    const table = Table.getRootTable(new ByteBuffer(builder.asUint8Array()));

    expect(() => {
      parser.toObject(table);
    }).toThrow("Union of struct is not currently supported");
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
      readFileSync(`${__dirname}/test/gen/ByteVector.bfbs`),
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
      readFileSync(`${__dirname}/test/gen/ByteVector.bfbs`),
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
      readFileSync(`${__dirname}/test/gen/ByteVector.bfbs`),
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
    const reflectionSchemaBuffer = readFileSync(`${__dirname}/vendor/gen/reflection.bfbs`);
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

  it("reads arrays", () => {
    const schema = Schema.getRootAsSchema(
      new ByteBuffer(readFileSync(`${__dirname}/test/gen/ArraysTable.bfbs`)),
    );
    const parser = new Parser(schema);

    const arraysTable = new ArraysTableT(
      [new Point3bT([1, 2, 3])],
      [new Point3sT([500, 501, 502])],
      1,
      [new Point3iT([100_000, 100_001, 100_002])],
      [new Point3lT(0, [1_000_000n, 1_000_001n, 1_000_002n])],
      [new Point3fT([1.5, 2.5, 3.5])],
      [new Point3dT([1.1, 2.1, 3.1])],
      [new Point3eT([Color.Red, Color.Green, Color.Blue])],
      new Mat3x3bT([
        new Point3bT([10, 11, 12]),
        new Point3bT([13, 14, 15]),
        new Point3bT([16, 17, 18]),
      ]),
      new Mat3x3sT([
        new Point3sT([20, 21, 22]),
        new Point3sT([23, 24, 25]),
        new Point3sT([26, 27, 28]),
      ]),
      1,
      new Mat3x3iT([
        new Point3iT([30, 31, 32]),
        new Point3iT([33, 34, 35]),
        new Point3iT([36, 37, 38]),
      ]),
      new Mat3x3lT(1, [
        new Point3lT(0, [40n, 41n, 42n]),
        new Point3lT(0, [43n, 44n, 45n]),
        new Point3lT(0, [46n, 47n, 48n]),
      ]),
      new Mat3x3fT([
        new Point3fT([1.5, 2.5, 3.5]),
        new Point3fT([4.5, 5.5, 6.5]),
        new Point3fT([7.5, 8.5, 9.5]),
      ]),
      new Mat3x3dT([
        new Point3dT([1.1, 2.1, 3.1]),
        new Point3dT([4.1, 5.1, 6.1]),
        new Point3dT([7.1, 8.1, 9.1]),
      ]),
      new Mat3x3eT([
        new Point3eT([Color.Red, Color.Green, Color.Blue]),
        new Point3eT([Color.Green, Color.Red, Color.Blue]),
        new Point3eT([Color.Green, Color.Blue, Color.Red]),
      ]),
    );

    const builder = new Builder();
    ArraysTable.finishArraysTableBuffer(builder, arraysTable.pack(builder));
    const fbBuffer = new ByteBuffer(builder.asUint8Array());

    const table = Table.getRootTable(fbBuffer);
    expect(parser.toObject(table)).toEqual({
      point3b_vec: arraysTable.point3bVec.map((p) => ({ ...p })),
      point3s_vec: arraysTable.point3sVec.map((p) => ({ ...p })),
      pad1: 1,
      point3i_vec: arraysTable.point3iVec.map((p) => ({ ...p })),
      point3l_vec: arraysTable.point3lVec.map((p) => ({ ...p })),
      point3f_vec: arraysTable.point3fVec.map((p) => ({ ...p })),
      point3d_vec: arraysTable.point3dVec.map((p) => ({ ...p })),
      point3e_vec: arraysTable.point3eVec.map((p) => ({ ...p })),
      mat3x3b: { cols: arraysTable.mat3x3b?.cols.map((p) => ({ ...p })) },
      mat3x3s: { cols: arraysTable.mat3x3s?.cols.map((p) => ({ ...p })) },
      pad2: 1,
      mat3x3i: { cols: arraysTable.mat3x3i?.cols.map((p) => ({ ...p })) },
      mat3x3l: { pad1: 1, cols: arraysTable.mat3x3l?.cols.map((p) => ({ ...p })) },
      mat3x3f: { cols: arraysTable.mat3x3f?.cols.map((p) => ({ ...p })) },
      mat3x3d: { cols: arraysTable.mat3x3d?.cols.map((p) => ({ ...p })) },
      mat3x3e: { cols: arraysTable.mat3x3e?.cols.map((p) => ({ ...p })) },
    });
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
