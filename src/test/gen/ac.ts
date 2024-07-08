// automatically generated by the FlatBuffers compiler, do not modify

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */

import * as flatbuffers from 'flatbuffers';



export class AC implements flatbuffers.IUnpackableObject<ACT> {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):AC {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

count():number {
  return this.bb!.readFloat64(this.bb_pos);
}

static sizeOf():number {
  return 8;
}

static createAC(builder:flatbuffers.Builder, count: number):flatbuffers.Offset {
  builder.prep(8, 8);
  builder.writeFloat64(count);
  return builder.offset();
}


unpack(): ACT {
  return new ACT(
    this.count()
  );
}


unpackTo(_o: ACT): void {
  _o.count = this.count();
}
}

export class ACT implements flatbuffers.IGeneratedObject {
constructor(
  public count: number = 0.0
){}


pack(builder:flatbuffers.Builder): flatbuffers.Offset {
  return AC.createAC(builder,
    this.count
  );
}
}