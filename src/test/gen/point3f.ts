// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';



export class Point3f implements flatbuffers.IUnpackableObject<Point3fT> {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):Point3f {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

xyz(index: number):number|null {
    return this.bb!.readFloat32(this.bb_pos + 0 + index * 4);
}

static sizeOf():number {
  return 12;
}

static createPoint3f(builder:flatbuffers.Builder, xyz: number[]|null):flatbuffers.Offset {
  builder.prep(4, 12);

  for (let i = 2; i >= 0; --i) {
    builder.writeFloat32((xyz?.[i] ?? 0));

  }

  return builder.offset();
}


unpack(): Point3fT {
  return new Point3fT(
    this.bb!.createScalarList<number>(this.xyz.bind(this), 3)
  );
}


unpackTo(_o: Point3fT): void {
  _o.xyz = this.bb!.createScalarList<number>(this.xyz.bind(this), 3);
}
}

export class Point3fT implements flatbuffers.IGeneratedObject {
constructor(
  public xyz: (number)[] = []
){}


pack(builder:flatbuffers.Builder): flatbuffers.Offset {
  return Point3f.createPoint3f(builder,
    this.xyz
  );
}
}
