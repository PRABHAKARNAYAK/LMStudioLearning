// package: SchneiderElectric.Automation.Sodb.Messages
// file: source/assets/protos/GroupInfo.proto

import * as jspb from "google-protobuf";

export class Property extends jspb.Message {
  getTitle(): string;
  setTitle(value: string): void;

  getDescription(): string;
  setDescription(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Property.AsObject;
  static toObject(includeInstance: boolean, msg: Property): Property.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Property, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Property;
  static deserializeBinaryFromReader(message: Property, reader: jspb.BinaryReader): Property;
}

export namespace Property {
  export type AsObject = {
    title: string,
    description: string,
  }
}

export class Parameter extends jspb.Message {
  getIndex(): string;
  setIndex(value: string): void;

  getSubIndex(): string;
  setSubIndex(value: string): void;

  getUnit(): string;
  setUnit(value: string): void;

  getMin(): number;
  setMin(value: number): void;

  getMax(): number;
  setMax(value: number): void;

  getDefaultdata(): number;
  setDefaultdata(value: number): void;

  getMandatory(): boolean;
  setMandatory(value: boolean): void;

  getDescription(): string;
  setDescription(value: string): void;

  getInputtype(): string;
  setInputtype(value: string): void;

  getIssmm(): boolean;
  setIssmm(value: boolean): void;

  getBitsize(): number;
  setBitsize(value: number): void;

  getEsitype(): string;
  setEsitype(value: string): void;

  getCanbemappedasrxpdo(): boolean;
  setCanbemappedasrxpdo(value: boolean): void;

  getCanbemappedastxpdo(): boolean;
  setCanbemappedastxpdo(value: boolean): void;

  getRecorddescription(): string;
  setRecorddescription(value: string): void;

  getOptions(): string;
  setOptions(value: string): void;

  getGroup(): string;
  setGroup(value: string): void;

  getTypevalue(): string;
  setTypevalue(value: string): void;

  getOriginaloptions(): string;
  setOriginaloptions(value: string): void;

  getName(): string;
  setName(value: string): void;

  getValue(): string;
  setValue(value: string): void;

  getReadonly(): boolean;
  setReadonly(value: boolean): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Parameter.AsObject;
  static toObject(includeInstance: boolean, msg: Parameter): Parameter.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Parameter, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Parameter;
  static deserializeBinaryFromReader(message: Parameter, reader: jspb.BinaryReader): Parameter;
}

export namespace Parameter {
  export type AsObject = {
    index: string,
    subIndex: string,
    unit: string,
    min: number,
    max: number,
    defaultdata: number,
    mandatory: boolean,
    description: string,
    inputtype: string,
    issmm: boolean,
    bitsize: number,
    esitype: string,
    canbemappedasrxpdo: boolean,
    canbemappedastxpdo: boolean,
    recorddescription: string,
    options: string,
    group: string,
    typevalue: string,
    originaloptions: string,
    name: string,
    value: string,
    readonly: boolean,
  }
}

export class SubGroup extends jspb.Message {
  getTitle(): string;
  setTitle(value: string): void;

  clearPropertiesList(): void;
  getPropertiesList(): Array<Property>;
  setPropertiesList(value: Array<Property>): void;
  addProperties(value?: Property, index?: number): Property;

  clearParametersList(): void;
  getParametersList(): Array<Parameter>;
  setParametersList(value: Array<Parameter>): void;
  addParameters(value?: Parameter, index?: number): Parameter;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): SubGroup.AsObject;
  static toObject(includeInstance: boolean, msg: SubGroup): SubGroup.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: SubGroup, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): SubGroup;
  static deserializeBinaryFromReader(message: SubGroup, reader: jspb.BinaryReader): SubGroup;
}

export namespace SubGroup {
  export type AsObject = {
    title: string,
    propertiesList: Array<Property.AsObject>,
    parametersList: Array<Parameter.AsObject>,
  }
}

export class Group extends jspb.Message {
  getId(): string;
  setId(value: string): void;

  clearSubGroupsList(): void;
  getSubGroupsList(): Array<SubGroup>;
  setSubGroupsList(value: Array<SubGroup>): void;
  addSubGroups(value?: SubGroup, index?: number): SubGroup;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Group.AsObject;
  static toObject(includeInstance: boolean, msg: Group): Group.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Group, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Group;
  static deserializeBinaryFromReader(message: Group, reader: jspb.BinaryReader): Group;
}

export namespace Group {
  export type AsObject = {
    id: string,
    subGroupsList: Array<SubGroup.AsObject>,
  }
}

export class Groups extends jspb.Message {
  getGroupsMap(): jspb.Map<string, Group>;
  clearGroupsMap(): void;
  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): Groups.AsObject;
  static toObject(includeInstance: boolean, msg: Groups): Groups.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: Groups, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): Groups;
  static deserializeBinaryFromReader(message: Groups, reader: jspb.BinaryReader): Groups;
}

export namespace Groups {
  export type AsObject = {
    groupsMap: Array<[string, Group.AsObject]>,
  }
}

export class ParamRequest extends jspb.Message {
  getGroupid(): string;
  setGroupid(value: string): void;

  getGrpcendpoint(): string;
  setGrpcendpoint(value: string): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ParamRequest.AsObject;
  static toObject(includeInstance: boolean, msg: ParamRequest): ParamRequest.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ParamRequest, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ParamRequest;
  static deserializeBinaryFromReader(message: ParamRequest, reader: jspb.BinaryReader): ParamRequest;
}

export namespace ParamRequest {
  export type AsObject = {
    groupid: string,
    grpcendpoint: string,
  }
}

export class ParamResponse extends jspb.Message {
  getGroupnodes(): string;
  setGroupnodes(value: string): void;

  hasGroupinfo(): boolean;
  clearGroupinfo(): void;
  getGroupinfo(): Group | undefined;
  setGroupinfo(value?: Group): void;

  serializeBinary(): Uint8Array;
  toObject(includeInstance?: boolean): ParamResponse.AsObject;
  static toObject(includeInstance: boolean, msg: ParamResponse): ParamResponse.AsObject;
  static extensions: {[key: number]: jspb.ExtensionFieldInfo<jspb.Message>};
  static extensionsBinary: {[key: number]: jspb.ExtensionFieldBinaryInfo<jspb.Message>};
  static serializeBinaryToWriter(message: ParamResponse, writer: jspb.BinaryWriter): void;
  static deserializeBinary(bytes: Uint8Array): ParamResponse;
  static deserializeBinaryFromReader(message: ParamResponse, reader: jspb.BinaryReader): ParamResponse;
}

export namespace ParamResponse {
  export type AsObject = {
    groupnodes: string,
    groupinfo?: Group.AsObject,
  }
}

