export enum EntityTypes {
  UNDEFINED,
  WORKSPACE,
  FRAME,
  GROUP,
  ELEMENT,
  RECTANGLE,
  OVAL
}

export enum GroupEntityTypes {
  WORKSPACE = EntityTypes.WORKSPACE,
  FRAME = EntityTypes.FRAME,
  GROUP = EntityTypes.GROUP
}
