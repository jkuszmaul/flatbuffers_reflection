// automatically generated by the FlatBuffers compiler, do not modify

import { Arms } from './arms';
import { Gemstone } from './gemstone';
import { Skull } from './skull';


export enum ShieldDecorator {
  NONE = 0,
  Gemstone = 1,
  Arms = 2,
  Skull = 3
}

export function unionToShieldDecorator(
  type: ShieldDecorator,
  accessor: (obj:Arms|Gemstone|Skull) => Arms|Gemstone|Skull|null
): Arms|Gemstone|Skull|null {
  switch(ShieldDecorator[type]) {
    case 'NONE': return null; 
    case 'Gemstone': return accessor(new Gemstone())! as Gemstone;
    case 'Arms': return accessor(new Arms())! as Arms;
    case 'Skull': return accessor(new Skull())! as Skull;
    default: return null;
  }
}

export function unionListToShieldDecorator(
  type: ShieldDecorator, 
  accessor: (index: number, obj:Arms|Gemstone|Skull) => Arms|Gemstone|Skull|null, 
  index: number
): Arms|Gemstone|Skull|null {
  switch(ShieldDecorator[type]) {
    case 'NONE': return null; 
    case 'Gemstone': return accessor(index, new Gemstone())! as Gemstone;
    case 'Arms': return accessor(index, new Arms())! as Arms;
    case 'Skull': return accessor(index, new Skull())! as Skull;
    default: return null;
  }
}
