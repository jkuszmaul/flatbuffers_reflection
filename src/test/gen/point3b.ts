// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';



export class Point3b implements flatbuffers.IUnpackableObject<Point3bT> {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):Point3b {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

xyz(index: number):number|null {
    return this.bb!.readInt8(this.bb_pos + 0 + index);
}

static sizeOf():number {
  return 3;
}

static createPoint3b(builder:flatbuffers.Builder, xyz: number[]|null):flatbuffers.Offset {
  builder.prep(1, 3);

  for (let i = 2; i >= 0; --i) {
    builder.writeInt8((xyz?.[i] ?? 0));

  }

  return builder.offset();
}


unpack(): Point3bT {
  return new Point3bT(
    this.bb!.createScalarList<number>(this.xyz.bind(this), 3)
  );
}


unpackTo(_o: Point3bT): void {
  _o.xyz = this.bb!.createScalarList<number>(this.xyz.bind(this), 3);
}
}

export class Point3bT implements flatbuffers.IGeneratedObject {
constructor(
  public xyz: (number)[] = []
){}


pack(builder:flatbuffers.Builder): flatbuffers.Offset {
  return Point3b.createPoint3b(builder,
    this.xyz
  );
}
}