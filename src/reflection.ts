// This file is essentially a clone of upstream flatbuffers code which
// uses different (less-restrictive) linters.
/* eslint no-underscore-dangle: 0 */
/* eslint no-restricted-syntax: 0 */
/* eslint @foxglove/strict-equality: 0 */
/* eslint @foxglove/no-boolean-parameters: 0 */
/* eslint @typescript-eslint/switch-exhaustiveness-check: 0 */
/* eslint @typescript-eslint/restrict-plus-operands: 0 */
/* eslint @typescript-eslint/no-explicit-any: 0 */

// This library provides a few basic reflection utilities for Flatbuffers.
// Currently, this only really supports the level of reflection that would
// be necessary to convert a serialized flatbuffer to JSON using just a
// reflection.Schema flatbuffer describing the type.
// Note that this currently assumes that reflection.fbs is codegen'd to
// typescript using --ts-flat-file and made available at
// 'flatbuffers_refleciton/reflection_generated'. If you are using the
// provided bazel rules, this is managed for you.
// See tests/reflection_test.ts for sample usage.

import { ByteBuffer } from "flatbuffers";

import * as reflection from "./reflection_generated";

// Returns the size, in bytes, of the given type. For vectors/strings/etc.
// returns the size of the offset.
function typeSize(baseType: reflection.BaseType): number {
  switch (baseType) {
    case reflection.BaseType.None:
    case reflection.BaseType.UType:
    case reflection.BaseType.Bool:
    case reflection.BaseType.Byte:
    case reflection.BaseType.UByte:
      return 1;
    case reflection.BaseType.Short:
    case reflection.BaseType.UShort:
      return 2;
    case reflection.BaseType.Int:
    case reflection.BaseType.UInt:
      return 4;
    case reflection.BaseType.Long:
    case reflection.BaseType.ULong:
      return 8;
    case reflection.BaseType.Float:
      return 4;
    case reflection.BaseType.Double:
      return 8;
    case reflection.BaseType.String:
    case reflection.BaseType.Vector:
    case reflection.BaseType.Obj:
    case reflection.BaseType.Union:
    case reflection.BaseType.Array:
      return 4;
  }
  return NaN;
}

// Returns whether the given type is a scalar type.
function isScalar(baseType: reflection.BaseType): boolean {
  switch (baseType) {
    case reflection.BaseType.UType:
    case reflection.BaseType.Bool:
    case reflection.BaseType.Byte:
    case reflection.BaseType.UByte:
    case reflection.BaseType.Short:
    case reflection.BaseType.UShort:
    case reflection.BaseType.Int:
    case reflection.BaseType.UInt:
    case reflection.BaseType.Long:
    case reflection.BaseType.ULong:
    case reflection.BaseType.Float:
    case reflection.BaseType.Double:
      return true;
    case reflection.BaseType.None:
    case reflection.BaseType.String:
    case reflection.BaseType.Vector:
    case reflection.BaseType.Obj:
    case reflection.BaseType.Union:
    case reflection.BaseType.Array:
      return false;
  }
  return false;
}

// Stores the data associated with a Table within a given buffer.
export class Table {
  // Wrapper to represent an object (Table or Struct) within a ByteBuffer.
  // The ByteBuffer is the raw data associated with the object.
  // typeIndex is an index into the schema object vector for the parser
  // object that this is associated with.
  // offset is the absolute location within the buffer where the root of the
  // object is.
  // isStruct indicates whether the object in question is a flatbuffers struct
  //   or table (this is relevant for doing some memory bounds checks).
  // Note that a given Table assumes that it is being used with a particular
  // Schema object.
  // External users should generally not be using this constructor directly.
  constructor(
    public readonly bb: ByteBuffer,
    public readonly typeIndex: number,
    public readonly offset: number,
    public readonly isStruct: boolean,
  ) {
    // See https://flatbuffers.dev/md__internals.html for format details.

    // Check that the table could plausibly fit in bounds
    if (offset < 0 || offset + 4 > bb.capacity()) {
      throw new Error(
        `Attempt to construct Table with offset ${offset}, which would extend beyond ByteBuffer (capacity ${bb.capacity()})`,
      );
    }
    if (isStruct) {
      // If this is a struct, we don't have a vtable, so the below checks don't
      // apply.
      return;
    }
    // Check that the table's vtable could fit in bounds
    const offsetToVtable = bb.readInt32(offset);
    const vtableOffset = offset - offsetToVtable;
    const vtableMinSize = 2 * 2; // 2x uint16: vtable size and object size
    if (vtableOffset < 0 || vtableOffset + vtableMinSize > bb.capacity()) {
      throw new Error(
        `Table at offset ${offset} points to vtable at ${vtableOffset} (${offset} - ${offsetToVtable}), which would extend beyond the ByteBuffer (capacity ${bb.capacity()})`,
      );
    }

    // The vtable's first entry is the size of the vtable itself; check that it fits in bounds.
    const vtableActualSize = bb.readUint16(vtableOffset);
    if (vtableActualSize < 4) {
      throw new Error(
        `Table at offset ${offset} points to vtable at ${vtableOffset} (${offset} - ${offsetToVtable}), which specifies vtable size ${vtableActualSize}, which should be at least 4 (vtable size + object size)`,
      );
    }
    if (vtableOffset + vtableActualSize > bb.capacity()) {
      throw new Error(
        `Table at offset ${offset} points to vtable at ${vtableOffset} (${offset} - ${offsetToVtable}), which specifies vtable size ${vtableActualSize}, which would extend beyond the ByteBuffer (capacity ${bb.capacity()})`,
      );
    }

    // The vtable's second entry is the size of the table's inline fields; check that it fits in bounds.
    const objectSize = bb.readUint16(vtableOffset + 2);
    if (objectSize < 4) {
      throw new Error(
        `Table at offset ${offset} points to vtable at ${vtableOffset} (${offset} - ${offsetToVtable}), which specifies inline object size ${objectSize}, which should be at least 4 (vtable offset)`,
      );
    }
    if (offset + objectSize > bb.capacity()) {
      throw new Error(
        `Table at offset ${offset} points to vtable at ${vtableOffset} (${offset} - ${offsetToVtable}), which specifies inline object size ${objectSize}, which would extend beyond the ByteBuffer (capacity ${bb.capacity()})`,
      );
    }
  }

  // Constructs a Table object for the root of a ByteBuffer--this assumes that
  // the type of the Table is the root table of the Parser that you are using.
  // This assumes that the root table is a flatbuffers table, not a struct.
  static getRootTable(bb: ByteBuffer): Table {
    if (bb.position() + 4 > bb.capacity()) {
      throw new Error(
        `Attempt to parse root table offset from ${bb.position()}, which would extend beyond ByteBuffer (capacity ${bb.capacity()})`,
      );
    }
    // Additional bounds checks happen in the Table constructor
    return new Table(bb, -1, bb.readUint32(bb.position()) + bb.position(), false);
  }
  // Constructs a table from a type name instead of from a type index.
  static getNamedTable(
    bb: ByteBuffer,
    schema: reflection.Schema,
    type: string,
    offset?: number,
  ): Table {
    for (let ii = 0; ii < schema.objectsLength(); ++ii) {
      const schemaObject = schema.objects(ii);
      if (schemaObject !== null && schemaObject.name() === type) {
        return new Table(
          bb,
          ii,
          offset === undefined ? bb.readUint32(bb.position()) + bb.position() : offset,
          schemaObject.isStruct(),
        );
      }
    }
    throw new Error("Unable to find type " + type + " in schema.");
  }
  // Reads a scalar of a given type at a given offset.
  readScalar(fieldType: reflection.BaseType, offset: number): number | bigint | boolean {
    const size = typeSize(fieldType);
    if (offset < 0 || offset + size > this.bb.capacity()) {
      throw new Error(
        `Attempt to read scalar type ${fieldType} (size ${size}) at offset ${offset}, which would extend beyond ByteBuffer (capacity ${this.bb.capacity()})`,
      );
    }
    switch (fieldType) {
      case reflection.BaseType.Bool:
        return this.bb.readUint8(offset) !== 0;
      case reflection.BaseType.Byte:
        return this.bb.readInt8(offset);
      case reflection.BaseType.UType:
      case reflection.BaseType.UByte:
        return this.bb.readUint8(offset);
      case reflection.BaseType.Short:
        return this.bb.readInt16(offset);
      case reflection.BaseType.UShort:
        return this.bb.readUint16(offset);
      case reflection.BaseType.Int:
        return this.bb.readInt32(offset);
      case reflection.BaseType.UInt:
        return this.bb.readUint32(offset);
      case reflection.BaseType.Long:
        return this.bb.readInt64(offset);
      case reflection.BaseType.ULong:
        return this.bb.readUint64(offset);
      case reflection.BaseType.Float:
        return this.bb.readFloat32(offset);
      case reflection.BaseType.Double:
        return this.bb.readFloat64(offset);
    }
    throw new Error(`Unsupported message type ${fieldType}`);
  }
}

// The Parser class uses a Schema to provide all the utilities required to
// parse flatbuffers that have a type that is the same as the root_type defined
// by the Schema.
// The classical usage would be to, e.g., be reading a channel with a type of
// "foo.Bar". At startup, you would construct a Parser from the channel's
// Schema. When a message is received on the channel , you would then use
// Table.getRootTable() on the received buffer to construct the Table, and
// then access the members using the various methods of the Parser (or just
// convert the entire object to a javascript Object/JSON using toObject()).
// There are three basic ways to access fields in a Table:
// 1) Call toObject(), which turns the entire table into a javascript object.
//    This is not meant to be particularly fast, but is useful to, e.g.,
//    convert something to JSON, or as a debugging tool.
// 2) Call toObjectLambda() to get a function that lets you do the same thing
//    as toObject(), except that it preloads all the reflection-related work.
//    Note that this still deserializes the entire object, which may be
//    overkill for your application if you care about performance.
// 2) Use the read*Lambda() accessors: These return a function that lets you
//    access the specified field given a table. This is used by the plotter
//    to repeatedly access the same field on a bunch of tables of the same type,
//    without having to redo all the reflection-related work on every access.
// 3) Use the read*() accessors: These just call the lambda returned by
//    read*Lambda() for you, as a convenience. This is cleaner to use, but for
//    repeated lookups on tables of the same type, this may be inefficient.
export class Parser {
  constructor(private readonly schema: reflection.Schema) {}

  toObjectLambda(typeIndex: number, readDefaults = false): (t: Table) => Record<string, any> {
    const lambdas: Record<string, any> = {};
    const schema = this.getType(typeIndex);
    const numFields = schema.fieldsLength();
    for (let ii = 0; ii < numFields; ++ii) {
      const field = schema.fields(ii);
      if (field === null) {
        throw new Error("Malformed schema: field at index " + ii + " not populated.");
      }
      const fieldType = field.type();
      if (fieldType === null) {
        throw new Error('Malformed schema: "type" field of Field not populated.');
      }
      const fieldName = field.name();
      if (fieldName === null) {
        throw new Error('Malformed schema: "name" field of Field not populated.');
      }
      const baseType = fieldType.baseType();
      if (isScalar(baseType)) {
        lambdas[fieldName] = this.readScalarLambdaWithField(field, typeIndex, readDefaults);
      } else if (baseType === reflection.BaseType.String) {
        lambdas[fieldName] = this.readStringLambda(typeIndex, fieldName);
      } else if (baseType === reflection.BaseType.Obj) {
        const rawLambda = this.readTableLambda(typeIndex, fieldName);
        const subTableLambda = this.toObjectLambda(fieldType.index(), readDefaults);
        lambdas[fieldName] = (t: Table) => {
          const subTable = rawLambda(t);
          if (subTable === null) {
            return null;
          }
          return subTableLambda(subTable);
        };
      } else if (baseType === reflection.BaseType.Vector) {
        const elementType = fieldType.element();
        if (isScalar(elementType)) {
          lambdas[fieldName] = this.readVectorOfScalarsLambda(typeIndex, fieldName);
        } else if (elementType === reflection.BaseType.String) {
          lambdas[fieldName] = this.readVectorOfStringsLambda(typeIndex, fieldName);
        } else if (elementType === reflection.BaseType.Obj) {
          const vectorLambda = this.readVectorOfTablesLambda(typeIndex, fieldName);
          const subTableLambda = this.toObjectLambda(fieldType.index(), readDefaults);
          lambdas[fieldName] = (t: Table) => {
            const vector = vectorLambda(t);
            if (vector === null) {
              return null;
            }
            const result = [];
            for (const table of vector) {
              result.push(subTableLambda(table));
            }
            return result;
          };
        } else if (elementType === reflection.BaseType.Union) {
          // for a vector of union we also have the sidecar _type_ field
          // this has the discriminator values for each

          // For union types, the index points to the enum which has the valid types of the union
          const enumIndex = fieldType.index();

          const unionEnum = this.schema.enums(enumIndex);
          if (!unionEnum) {
            throw new Error("Malformed schema: missing enum for union type");
          }

          const unionDeserializers = new Map<number, (t: Table) => Record<string, any>>();

          for (let eidx = 0; eidx < unionEnum.valuesLength(); ++eidx) {
            const enumItem = unionEnum.values(eidx);
            if (!enumItem) {
              throw new Error("Malformed schema: missing enum item");
            }

            const specificType = enumItem.unionType();
            if (!specificType) {
              throw new Error("Malformed schema: union enum missing unionType");
            }

            // There is a placeholder for _None_ in the enum so we skip that type
            const typeIndex = specificType.index();
            if (typeIndex < 0) {
              continue;
            }

            const typeDeserializer = this.toObjectLambda(typeIndex, readDefaults);
            unionDeserializers.set(Number(enumItem.value()), typeDeserializer);
          }

          const next = ++ii;
          if (next >= numFields) {
            throw new Error(`Missing union discriminator field for field '${field.name()}'`);
          }

          const unionDiscriminator = schema.fields(next);
          if (!unionDiscriminator) {
            throw new Error(`Missing union discriminator field for field '${field.name()}'`);
          }

          const discriminatorfieldType = unionDiscriminator.type();
          if (discriminatorfieldType === null) {
            throw new Error('Malformed schema: "type" field of Field not populated.');
          }

          if (discriminatorfieldType.baseType() !== reflection.BaseType.Vector) {
            throw new Error(`Malformed schema: union discriminator field is not an array`);
          }

          discriminatorfieldType.element();

          const name = unionDiscriminator.name();
          if (!name) {
            throw new Error("changeme");
          }

          const readDiscriminators = this.readVectorOfScalarsLambdaField(unionDiscriminator);

          const vectorLambda = this.readVectorOfTablesLambda(typeIndex, fieldName);

          lambdas[fieldName] = (table: Table) => {
            const res = readDiscriminators(table);

            if (!res) {
              throw new Error("changeme");
            }

            const vector = vectorLambda(table);
            if (vector === null) {
              throw new Error("missing vector table");
            }

            if (res.length !== vector.length) {
              throw new Error("malformed - missmatch in vector lengths");
            }

            const result = [];
            for (let idx = 0; idx < vector.length; ++idx) {
              const discriminator = res[idx];
              if (typeof discriminator !== "number") {
                throw new Error(`Malformed union discriminator value is not a number`);
              }
              const deserializer = unionDeserializers.get(discriminator);
              if (!deserializer) {
                throw new Error(`Malformed message: could not find union type: '${discriminator}'`);
              }

              const subTable = vector[idx];
              if (!subTable) {
                throw new Error("changeme");
              }
              result.push(deserializer(subTable));
            }

            return result;
          };
        } else {
          throw new Error("Vectors of Arrays are not supported.");
        }
      } else if (baseType === reflection.BaseType.Union) {
        // For union types, the index points to the enum which has the valid types of the union
        const enumIndex = fieldType.index();

        const unionEnum = this.schema.enums(enumIndex);
        if (!unionEnum) {
          throw new Error("Malformed schema: missing enum for union type");
        }

        const unionDeserializers = new Map<number, (t: Table) => Record<string, any>>();

        for (let eidx = 0; eidx < unionEnum.valuesLength(); ++eidx) {
          const enumItem = unionEnum.values(eidx);
          if (!enumItem) {
            throw new Error("Malformed schema: missing enum item");
          }

          const specificType = enumItem.unionType();
          if (!specificType) {
            throw new Error("Malformed schema: union enum missing unionType");
          }

          // There is a placeholder for _None_ in the enum so we skip that type
          const typeIndex = specificType.index();
          if (typeIndex < 0) {
            continue;
          }

          const typeDeserializer = this.toObjectLambda(typeIndex, readDefaults);
          unionDeserializers.set(Number(enumItem.value()), typeDeserializer);
        }

        const next = ++ii;
        if (next >= numFields) {
          throw new Error(`Missing union discriminator field for field '${field.name()}'`);
        }

        const unionDiscriminator = schema.fields(next);
        if (!unionDiscriminator) {
          throw new Error(`Missing union discriminator field for field '${field.name()}'`);
        }

        const discriminatorfieldType = unionDiscriminator.type();
        if (discriminatorfieldType === null) {
          throw new Error('Malformed schema: "type" field of Field not populated.');
        }

        if (!isScalar(discriminatorfieldType.baseType())) {
          throw new Error(`Malformed schema: union discriminator field is not a scalar`);
        }

        // reader for the discriminator enum value
        const scalar = this.readScalarLambdaWithField(
          unionDiscriminator,
          discriminatorfieldType.index(),
          readDefaults,
        );

        // Unions can only be formed from tables so we know our union field will point to a table
        const rawLambda = this.readTableLambda(typeIndex, fieldName);

        lambdas[fieldName] = (table: Table) => {
          const discriminatorValue = scalar(table);

          if (typeof discriminatorValue !== "number") {
            throw new Error(`Malformed union discriminator value is not a number`);
          }

          const deserializer = unionDeserializers.get(discriminatorValue);
          if (!deserializer) {
            throw new Error(
              `Malformed message: could not find union type: '${discriminatorValue}'`,
            );
          }

          const subTable = rawLambda(table);
          if (!subTable) {
            throw new Error(`Malformed message: missing union field table: '${fieldName}'`);
          }
          return deserializer(subTable);
        };
      } else {
        throw new Error(`Arrays are not supported in field '${field.name()}'`);
      }
    }
    return (t: Table) => {
      const obj: Record<string, any> = {};
      // Go through and attempt to use every single field accessor; return the
      // resulting object.
      for (const field in lambdas) {
        const value = lambdas[field](t);
        if (value !== null) {
          obj[field] = value;
        }
      }
      return obj;
    };
  }

  // Parse a Table to a javascript object. This is can be used, e.g., to convert
  // a flatbuffer Table to JSON.
  // If readDefaults is set to true, then scalar fields will be filled out with
  // their default values if not populated; if readDefaults is false and the
  // field is not populated, the resulting object will not populate the field.
  toObject(table: Table, readDefaults = false): Record<string, any> {
    return this.toObjectLambda(table.typeIndex, readDefaults)(table);
  }

  // Returns the Object definition associated with the given type index.
  getType(typeIndex: number): reflection.Object_ {
    if (typeIndex === -1) {
      const rootTable = this.schema.rootTable();
      if (rootTable === null) {
        throw new Error("Malformed schema: No root table.");
      }
      return rootTable;
    }
    if (typeIndex < 0 || typeIndex > this.schema.objectsLength()) {
      throw new Error("Type index out-of-range.");
    }
    const table = this.schema.objects(typeIndex);
    if (table === null) {
      throw new Error("Malformed schema: No object at index " + typeIndex + ".");
    }
    return table;
  }

  // Retrieves the Field schema for the given field name within a given
  // type index.
  getField(fieldName: string, typeIndex: number): reflection.Field {
    const schema: reflection.Object_ = this.getType(typeIndex);
    const numFields = schema.fieldsLength();
    for (let ii = 0; ii < numFields; ++ii) {
      const field = schema.fields(ii);
      if (field === null) {
        throw new Error("Malformed schema: Missing Field table at index " + ii + ".");
      }
      const name = field.name();
      if (fieldName === name) {
        return field;
      }
    }
    throw new Error("Couldn't find field " + fieldName + " in object " + schema.name() + ".");
  }

  // Reads a scalar with the given field name from a Table. If readDefaults
  // is set to false and the field is unset, we will return null. If
  // readDefaults is true and the field is unset, we will look-up the default
  // value for the field and return that.
  // For 64-bit fields, returns a BigInt rather than a standard number.
  readScalar(
    table: Table,
    fieldName: string,
    readDefaults = false,
  ): number | bigint | boolean | null {
    return this.readScalarLambda(table.typeIndex, fieldName, readDefaults)(table);
  }

  // Like readScalar(), except that this returns an accessor for the specified
  // field, rather than the value of the field itself.
  // Note that the *Lambda() methods take a typeIndex instead of a Table, which
  // can be obtained using table.typeIndex.
  readScalarLambda(
    typeIndex: number,
    fieldName: string,
    readDefaults = false,
  ): (t: Table) => number | bigint | boolean | null {
    const field = this.getField(fieldName, typeIndex);
    return this.readScalarLambdaWithField(field, typeIndex, readDefaults);
  }

  // Like readScalar(), except that this returns an accessor for the specified
  // field, rather than the value of the field itself.
  // Note that the *Lambda() methods take a typeIndex instead of a Table, which
  // can be obtained using table.typeIndex.
  private readScalarLambdaWithField(
    field: reflection.Field,
    typeIndex: number,
    readDefaults = false,
  ): (t: Table) => number | bigint | boolean | null {
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    const isStruct = this.getType(typeIndex).isStruct();
    if (!isScalar(fieldType.baseType())) {
      throw new Error("Field " + field.name() + " is not a scalar type.");
    }

    if (isStruct) {
      const baseType = fieldType.baseType();
      return (t: Table) => {
        return t.readScalar(baseType, t.offset + field.offset());
      };
    }

    return (t: Table) => {
      const offset = t.offset + t.bb.__offset(t.offset, field.offset());
      if (offset === t.offset) {
        if (!readDefaults) {
          return null;
        }
        switch (fieldType.baseType()) {
          case reflection.BaseType.Bool:
            return field.defaultInteger() !== 0n;
          case reflection.BaseType.Long:
          case reflection.BaseType.ULong:
            return field.defaultInteger();
          case reflection.BaseType.UType:
          case reflection.BaseType.Byte:
          case reflection.BaseType.UByte:
          case reflection.BaseType.Short:
          case reflection.BaseType.UShort:
          case reflection.BaseType.Int:
          case reflection.BaseType.UInt:
            return Number(field.defaultInteger());
          case reflection.BaseType.Float:
          case reflection.BaseType.Double:
            return field.defaultReal();
          default:
            throw new Error(`Expected scalar type, found ${fieldType.baseType()}`);
        }
      }
      return t.readScalar(fieldType.baseType(), offset);
    };
  }
  // Reads a string with the given field name from the provided Table.
  // If the field is unset, returns null.
  readString(table: Table, fieldName: string): string | null {
    return this.readStringLambda(table.typeIndex, fieldName)(table);
  }

  readStringLambda(typeIndex: number, fieldName: string): (t: Table) => string | null {
    const field = this.getField(fieldName, typeIndex);
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    if (fieldType.baseType() !== reflection.BaseType.String) {
      throw new Error("Field " + fieldName + " is not a string.");
    }

    return (t: Table) => {
      const offsetToOffset = t.offset + t.bb.__offset(t.offset, field.offset());
      if (offsetToOffset === t.offset) {
        return null;
      }
      return t.bb.__string(offsetToOffset) as string;
    };
  }
  // Reads a sub-message from the given Table. The sub-message may either be
  // a struct or a Table. Returns null if the sub-message is not set.
  readTable(table: Table, fieldName: string): Table | null {
    return this.readTableLambda(table.typeIndex, fieldName)(table);
  }
  readTableLambda(typeIndex: number, fieldName: string): (t: Table) => Table | null {
    const field = this.getField(fieldName, typeIndex);
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    const parentIsStruct = this.getType(typeIndex).isStruct();
    if (
      fieldType.baseType() !== reflection.BaseType.Obj &&
      fieldType.baseType() !== reflection.BaseType.Union
    ) {
      throw new Error(`Field ${fieldName} is not an object or union type: ${fieldType.baseType()}`);
    }

    const elementIsStruct = this.getType(fieldType.index()).isStruct();

    if (parentIsStruct) {
      return (t: Table) => {
        return new Table(t.bb, fieldType.index(), t.offset + field.offset(), elementIsStruct);
      };
    }

    return (table: Table) => {
      const offsetToOffset = table.offset + table.bb.__offset(table.offset, field.offset());
      if (offsetToOffset === table.offset) {
        return null;
      }

      const objectStart = elementIsStruct ? offsetToOffset : table.bb.__indirect(offsetToOffset);
      return new Table(table.bb, fieldType.index(), objectStart, elementIsStruct);
    };
  }
  // Reads a vector of scalars (like readScalar, may return a vector of BigInt's
  // instead). Also, will return null if the vector is not set.
  readVectorOfScalars(
    table: Table,
    fieldName: string,
  ): (number | bigint | boolean)[] | Uint8Array | null {
    return this.readVectorOfScalarsLambda(table.typeIndex, fieldName)(table);
  }

  readVectorOfScalarsLambdaField(
    field: reflection.Field,
  ): (t: Table) => (number | bigint | boolean)[] | Uint8Array | null {
    const fieldName = field.name();
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    if (fieldType.baseType() !== reflection.BaseType.Vector) {
      throw new Error("Field " + fieldName + " is not an vector.");
    }
    const elementType = fieldType.element();
    if (!isScalar(elementType)) {
      throw new Error("Field " + fieldName + " is not an vector of scalars.");
    }
    const isUByteVector = elementType === reflection.BaseType.UByte;

    return (table: Table) => {
      const offsetToOffset = table.offset + table.bb.__offset(table.offset, field.offset());
      if (offsetToOffset === table.offset) {
        return null;
      }

      const numElements = table.bb.__vector_len(offsetToOffset);
      const baseOffset = table.bb.__vector(offsetToOffset);
      const scalarSize = typeSize(fieldType.element());

      let result: (number | bigint | boolean)[] | Uint8Array;
      // If the vector is a byte vector, we can return a slice into the buffer
      if (isUByteVector) {
        result = new Uint8Array(
          table.bb.bytes().buffer,
          table.bb.bytes().byteOffset + baseOffset,
          numElements,
        );
      } else {
        result = [];
        for (let ii = 0; ii < numElements; ++ii) {
          result.push(table.readScalar(fieldType.element(), baseOffset + scalarSize * ii));
        }
      }
      return result;
    };
  }

  readVectorOfScalarsLambda(
    typeIndex: number,
    fieldName: string,
  ): (t: Table) => (number | bigint | boolean)[] | Uint8Array | null {
    const field = this.getField(fieldName, typeIndex);
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    if (fieldType.baseType() !== reflection.BaseType.Vector) {
      throw new Error("Field " + fieldName + " is not an vector.");
    }
    const elementType = fieldType.element();
    if (!isScalar(elementType)) {
      throw new Error("Field " + fieldName + " is not an vector of scalars.");
    }
    const isUByteVector = elementType === reflection.BaseType.UByte;

    return (table: Table) => {
      const offsetToOffset = table.offset + table.bb.__offset(table.offset, field.offset());
      if (offsetToOffset === table.offset) {
        return null;
      }

      const numElements = table.bb.__vector_len(offsetToOffset);
      const baseOffset = table.bb.__vector(offsetToOffset);
      const scalarSize = typeSize(fieldType.element());

      let result: (number | bigint | boolean)[] | Uint8Array;
      // If the vector is a byte vector, we can return a slice into the buffer
      if (isUByteVector) {
        result = new Uint8Array(
          table.bb.bytes().buffer,
          table.bb.bytes().byteOffset + baseOffset,
          numElements,
        );
      } else {
        result = [];
        for (let ii = 0; ii < numElements; ++ii) {
          result.push(table.readScalar(fieldType.element(), baseOffset + scalarSize * ii));
        }
      }
      return result;
    };
  }
  // Reads a vector of tables. Returns null if vector is not set.
  readVectorOfTables(table: Table, fieldName: string): Table[] | null {
    return this.readVectorOfTablesLambda(table.typeIndex, fieldName)(table);
  }
  readVectorOfTablesLambda(typeIndex: number, fieldName: string): (t: Table) => Table[] | null {
    const field = this.getField(fieldName, typeIndex);
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    if (fieldType.baseType() !== reflection.BaseType.Vector) {
      throw new Error("Field " + fieldName + " is not an vector.");
    }
    if (
      fieldType.element() !== reflection.BaseType.Obj &&
      fieldType.element() !== reflection.BaseType.Union
    ) {
      throw new Error("Field " + fieldName + " is not an vector of objects or union.");
    }

    const elementSchema = this.getType(fieldType.index());
    const elementIsStruct = elementSchema.isStruct();
    const elementSize = elementIsStruct ? elementSchema.bytesize() : typeSize(fieldType.element());

    return (table: Table) => {
      const offsetToOffset = table.offset + table.bb.__offset(table.offset, field.offset());
      if (offsetToOffset === table.offset) {
        return null;
      }
      const numElements = table.bb.__vector_len(offsetToOffset);
      const result = [];
      const baseOffset = table.bb.__vector(offsetToOffset);
      for (let ii = 0; ii < numElements; ++ii) {
        const elementOffset = baseOffset + elementSize * ii;
        result.push(
          new Table(
            table.bb,
            fieldType.index(),
            elementIsStruct ? elementOffset : table.bb.__indirect(elementOffset),
            elementIsStruct,
          ),
        );
      }
      return result;
    };
  }
  // Reads a vector of strings. Returns null if not set.
  readVectorOfStrings(table: Table, fieldName: string): string[] | null {
    return this.readVectorOfStringsLambda(table.typeIndex, fieldName)(table);
  }
  readVectorOfStringsLambda(typeIndex: number, fieldName: string): (t: Table) => string[] | null {
    const field = this.getField(fieldName, typeIndex);
    const fieldType = field.type();
    if (fieldType === null) {
      throw new Error('Malformed schema: "type" field of Field not populated.');
    }
    if (fieldType.baseType() !== reflection.BaseType.Vector) {
      throw new Error("Field " + fieldName + " is not an vector.");
    }
    if (fieldType.element() !== reflection.BaseType.String) {
      throw new Error("Field " + fieldName + " is not an vector of strings.");
    }

    return (table: Table) => {
      const offsetToOffset = table.offset + table.bb.__offset(table.offset, field.offset());
      if (offsetToOffset === table.offset) {
        return null;
      }
      const numElements = table.bb.__vector_len(offsetToOffset);
      const result = [];
      const baseOffset = table.bb.__vector(offsetToOffset);
      const offsetSize = typeSize(fieldType.element());
      for (let ii = 0; ii < numElements; ++ii) {
        result.push(table.bb.__string(baseOffset + offsetSize * ii) as string);
      }
      return result;
    };
  }
}
