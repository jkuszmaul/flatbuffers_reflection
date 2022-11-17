import { Builder, ByteBuffer } from "flatbuffers";
import { Parser, Table } from "./reflection";
import { BaseType, EnumVal, Schema, Type } from "./reflection_generated";
import { ByteVector } from "./ByteVector_generated";
import { readFileSync } from "fs";
function stringify(obj: any): string {
  return JSON.stringify(obj, (_, value) => (typeof value === "bigint" ? value.toString() : value));
}

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
      EnumVal.addValue(builder, BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1));
      EnumVal.addDocumentation(builder, docVector);
      EnumVal.addUnionType(builder, typeOffset);
      builder.finish(EnumVal.endEnumVal(builder));
      const array = builder.asUint8Array();
      const fbBuffer = new ByteBuffer(array);

      const reflectionFb = Table.getNamedTable(fbBuffer, schema, "reflection.EnumVal");
      expect(
        '{"documentation":["abc","def"],"name":"name","union_type":{"base_type":' +
          BaseType.Int +
          ',"index":123},"value":"9007199254740992"}',
      ).toEqual(stringify(parser.toObject(reflectionFb)));
      const typeFb = parser.readTable(reflectionFb, "union_type");
      if (typeFb === null) {
        throw new Error();
      }
      // Confirm that readDefaults works.
      expect(BigInt(4)).toEqual(parser.readScalar(typeFb, "base_size", true));
      expect(null).toEqual(parser.readScalar(typeFb, "base_size", false));
    }
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

    const byteVectorSchemaByteBuffer = new ByteBuffer(readFileSync(`${__dirname}/ByteVector.bfbs`));
    const rawSchema = Schema.getRootAsSchema(byteVectorSchemaByteBuffer);
    const parser = new Parser(rawSchema);
    const table = Table.getNamedTable(byteVectorBB, rawSchema, "ByteVector");
    const byteVectorObject = parser.toObject(table);
    expect(byteVectorObject["data"]).toEqual(new Uint8Array([1, 2, 3]));
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
