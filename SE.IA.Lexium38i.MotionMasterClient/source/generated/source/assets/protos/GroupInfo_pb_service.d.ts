// package: SchneiderElectric.Automation.Sodb.Messages
// file: source/assets/protos/GroupInfo.proto

import * as source_assets_protos_GroupInfo_pb from "../../../source/assets/protos/GroupInfo_pb";
import {grpc} from "@improbable-eng/grpc-web";

type GroupInfoServiceGetParametersDetail = {
  readonly methodName: string;
  readonly service: typeof GroupInfoService;
  readonly requestStream: false;
  readonly responseStream: false;
  readonly requestType: typeof source_assets_protos_GroupInfo_pb.ParamRequest;
  readonly responseType: typeof source_assets_protos_GroupInfo_pb.ParamResponse;
};

export class GroupInfoService {
  static readonly serviceName: string;
  static readonly GetParametersDetail: GroupInfoServiceGetParametersDetail;
}

export type ServiceError = { message: string, code: number; metadata: grpc.Metadata }
export type Status = { details: string, code: number; metadata: grpc.Metadata }

interface UnaryResponse {
  cancel(): void;
}
interface ResponseStream<T> {
  cancel(): void;
  on(type: 'data', handler: (message: T) => void): ResponseStream<T>;
  on(type: 'end', handler: (status?: Status) => void): ResponseStream<T>;
  on(type: 'status', handler: (status: Status) => void): ResponseStream<T>;
}
interface RequestStream<T> {
  write(message: T): RequestStream<T>;
  end(): void;
  cancel(): void;
  on(type: 'end', handler: (status?: Status) => void): RequestStream<T>;
  on(type: 'status', handler: (status: Status) => void): RequestStream<T>;
}
interface BidirectionalStream<ReqT, ResT> {
  write(message: ReqT): BidirectionalStream<ReqT, ResT>;
  end(): void;
  cancel(): void;
  on(type: 'data', handler: (message: ResT) => void): BidirectionalStream<ReqT, ResT>;
  on(type: 'end', handler: (status?: Status) => void): BidirectionalStream<ReqT, ResT>;
  on(type: 'status', handler: (status: Status) => void): BidirectionalStream<ReqT, ResT>;
}

export class GroupInfoServiceClient {
  readonly serviceHost: string;

  constructor(serviceHost: string, options?: grpc.RpcOptions);
  getParametersDetail(
    requestMessage: source_assets_protos_GroupInfo_pb.ParamRequest,
    metadata: grpc.Metadata,
    callback: (error: ServiceError|null, responseMessage: source_assets_protos_GroupInfo_pb.ParamResponse|null) => void
  ): UnaryResponse;
  getParametersDetail(
    requestMessage: source_assets_protos_GroupInfo_pb.ParamRequest,
    callback: (error: ServiceError|null, responseMessage: source_assets_protos_GroupInfo_pb.ParamResponse|null) => void
  ): UnaryResponse;
}

