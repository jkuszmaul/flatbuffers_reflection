// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';



export class Point3l implements flatbuffers.IUnpackableObject<Point3lT> {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):Point3l {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

xyz(index: number):bigint|null {
    return this.bb!.readInt64(this.bb_pos + 0 + index * 8);
}

static sizeOf():number {
  return 24;
}

static createPoint3l(builder:flatbuffers.Builder, xyz: bigint[]|null):flatbuffers.Offset {
  builder.prep(8, 24);

  for (let i = 2; i >= 0; --i) {
    builder.writeInt64(BigInt(xyz?.[i] ?? 0));
  }

  return builder.offset();
}


unpack(): Point3lT {
  return new Point3lT(
    this.bb!.createScalarList<bigint>(this.xyz.bind(this), 3)
  );
}


unpackTo(_o: Point3lT): void {
  _o.xyz = this.bb!.createScalarList<bigint>(this.xyz.bind(this), 3);
}
}

export class Point3lT implements flatbuffers.IGeneratedObject {
constructor(
  public xyz: (bigint)[] = []
){}


pack(builder:flatbuffers.Builder): flatbuffers.Offset {
  return Point3l.createPoint3l(builder,
    this.xyz
  );
}
}