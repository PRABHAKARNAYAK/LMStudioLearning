// package: SchneiderElectric.Automation.Sodb.Messages
// file: source/assets/protos/GroupInfo.proto

var source_assets_protos_GroupInfo_pb = require("../../../source/assets/protos/GroupInfo_pb");
var grpc = require("@improbable-eng/grpc-web").grpc;

var GroupInfoService = (function () {
  function GroupInfoService() {}
  GroupInfoService.serviceName = "SchneiderElectric.Automation.Sodb.Messages.GroupInfoService";
  return GroupInfoService;
}());

GroupInfoService.GetParametersDetail = {
  methodName: "GetParametersDetail",
  service: GroupInfoService,
  requestStream: false,
  responseStream: false,
  requestType: source_assets_protos_GroupInfo_pb.ParamRequest,
  responseType: source_assets_protos_GroupInfo_pb.ParamResponse
};

exports.GroupInfoService = GroupInfoService;

function GroupInfoServiceClient(serviceHost, options) {
  this.serviceHost = serviceHost;
  this.options = options || {};
}

GroupInfoServiceClient.prototype.getParametersDetail = function getParametersDetail(requestMessage, metadata, callback) {
  if (arguments.length === 2) {
    callback = arguments[1];
  }
  var client = grpc.unary(GroupInfoService.GetParametersDetail, {
    request: requestMessage,
    host: this.serviceHost,
    metadata: metadata,
    transport: this.options.transport,
    debug: this.options.debug,
    onEnd: function (response) {
      if (callback) {
        if (response.status !== grpc.Code.OK) {
          var err = new Error(response.statusMessage);
          err.code = response.status;
          err.metadata = response.trailers;
          callback(err, null);
        } else {
          callback(null, response.message);
        }
      }
    }
  });
  return {
    cancel: function () {
      callback = null;
      client.close();
    }
  };
};

exports.GroupInfoServiceClient = GroupInfoServiceClient;

