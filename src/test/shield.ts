// automatically generated by the FlatBuffers compiler, do not modify

import * as flatbuffers from 'flatbuffers';

import { ShieldDecorator } from './shield-decorator';


export class Shield {
  bb: flatbuffers.ByteBuffer|null = null;
  bb_pos = 0;
  __init(i:number, bb:flatbuffers.ByteBuffer):Shield {
  this.bb_pos = i;
  this.bb = bb;
  return this;
}

static getRootAsShield(bb:flatbuffers.ByteBuffer, obj?:Shield):Shield {
  return (obj || new Shield()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

static getSizePrefixedRootAsShield(bb:flatbuffers.ByteBuffer, obj?:Shield):Shield {
  bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
  return (obj || new Shield()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
}

protection():number {
  const offset = this.bb!.__offset(this.bb_pos, 4);
  return offset ? this.bb!.readFloat32(this.bb_pos + offset) : 0.0;
}

primaryDecoratorType():ShieldDecorator {
  const offset = this.bb!.__offset(this.bb_pos, 6);
  return offset ? this.bb!.readUint8(this.bb_pos + offset) : ShieldDecorator.NONE;
}

primaryDecorator(obj:any):any|null {
  const offset = this.bb!.__offset(this.bb_pos, 8);
  return offset ? this.bb!.__union(obj, this.bb_pos + offset) : null;
}

decoratorsType(index: number):ShieldDecorator|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.readUint8(this.bb!.__vector(this.bb_pos + offset) + index) : 0;
}

decoratorsTypeLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

decoratorsTypeArray():Uint8Array|null {
  const offset = this.bb!.__offset(this.bb_pos, 10);
  return offset ? new Uint8Array(this.bb!.bytes().buffer, this.bb!.bytes().byteOffset + this.bb!.__vector(this.bb_pos + offset), this.bb!.__vector_len(this.bb_pos + offset)) : null;
}

decorators(index: number, obj:any):any|null {
  const offset = this.bb!.__offset(this.bb_pos, 12);
  return offset ? this.bb!.__union(obj, this.bb!.__vector(this.bb_pos + offset) + index * 4) : null;
}

decoratorsLength():number {
  const offset = this.bb!.__offset(this.bb_pos, 12);
  return offset ? this.bb!.__vector_len(this.bb_pos + offset) : 0;
}

static startShield(builder:flatbuffers.Builder) {
  builder.startObject(5);
}

static addProtection(builder:flatbuffers.Builder, protection:number) {
  builder.addFieldFloat32(0, protection, 0.0);
}

static addPrimaryDecoratorType(builder:flatbuffers.Builder, primaryDecoratorType:ShieldDecorator) {
  builder.addFieldInt8(1, primaryDecoratorType, ShieldDecorator.NONE);
}

static addPrimaryDecorator(builder:flatbuffers.Builder, primaryDecoratorOffset:flatbuffers.Offset) {
  builder.addFieldOffset(2, primaryDecoratorOffset, 0);
}

static addDecoratorsType(builder:flatbuffers.Builder, decoratorsTypeOffset:flatbuffers.Offset) {
  builder.addFieldOffset(3, decoratorsTypeOffset, 0);
}

static createDecoratorsTypeVector(builder:flatbuffers.Builder, data:ShieldDecorator[]):flatbuffers.Offset {
  builder.startVector(1, data.length, 1);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addInt8(data[i]!);
  }
  return builder.endVector();
}

static startDecoratorsTypeVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(1, numElems, 1);
}

static addDecorators(builder:flatbuffers.Builder, decoratorsOffset:flatbuffers.Offset) {
  builder.addFieldOffset(4, decoratorsOffset, 0);
}

static createDecoratorsVector(builder:flatbuffers.Builder, data:flatbuffers.Offset[]):flatbuffers.Offset {
  builder.startVector(4, data.length, 4);
  for (let i = data.length - 1; i >= 0; i--) {
    builder.addOffset(data[i]!);
  }
  return builder.endVector();
}

static startDecoratorsVector(builder:flatbuffers.Builder, numElems:number) {
  builder.startVector(4, numElems, 4);
}

static endShield(builder:flatbuffers.Builder):flatbuffers.Offset {
  const offset = builder.endObject();
  return offset;
}

static createShield(builder:flatbuffers.Builder, protection:number, primaryDecoratorType:ShieldDecorator, primaryDecoratorOffset:flatbuffers.Offset, decoratorsTypeOffset:flatbuffers.Offset, decoratorsOffset:flatbuffers.Offset):flatbuffers.Offset {
  Shield.startShield(builder);
  Shield.addProtection(builder, protection);
  Shield.addPrimaryDecoratorType(builder, primaryDecoratorType);
  Shield.addPrimaryDecorator(builder, primaryDecoratorOffset);
  Shield.addDecoratorsType(builder, decoratorsTypeOffset);
  Shield.addDecorators(builder, decoratorsOffset);
  return Shield.endShield(builder);
}
}
