import express from "express";
import Lexium38iParameterInfoApi from "../controllers/Lexium38iParameterInfoApi";
import Lexium38iDiagnostics from "../controllers/Lexium38iDiagnostics";
import TuningApi from "../controllers/TuningApi";
import ControlPanelApi from "../controllers/ControlPanelApi";
import TuningTrajectoryApi from "../controllers/TuningTrajectoryApi";

const motionMasterClientApiRouter = express.Router();

motionMasterClientApiRouter.use(express.json({ limit: "10mb" }));
motionMasterClientApiRouter.use(express.urlencoded({ extended: false }));

motionMasterClientApiRouter.get("/devices/:deviceRef/groupInfo/:groupId", Lexium38iParameterInfoApi.getSelectedGroupInfo);
motionMasterClientApiRouter.get("/api/getGroupNodes/", Lexium38iParameterInfoApi.getGroupNodesInfo);
motionMasterClientApiRouter.get("/devices/:deviceRef/getDefaultParameterInfo", Lexium38iParameterInfoApi.getDefaultParameterInfo);
motionMasterClientApiRouter.get("/devices/:deviceRef/controlPanelInfo", Lexium38iParameterInfoApi.getControlPanelInfo);
motionMasterClientApiRouter.post("/devices/:deviceRef/startHoming", Lexium38iParameterInfoApi.startHoming);

motionMasterClientApiRouter.post("/devices/:deviceRef/startPositionProfile", ControlPanelApi.startPositionProfile);
motionMasterClientApiRouter.post("/devices/:deviceRef/startVelocityProfile", ControlPanelApi.startVelocityProfile);
motionMasterClientApiRouter.post("/devices/:deviceRef/startTorqueProfile", ControlPanelApi.startTorqueProfile);

motionMasterClientApiRouter.get("/api/startDiagnostics/:deviceRef", Lexium38iDiagnostics.startDiagnostics);
motionMasterClientApiRouter.get("/devices/:deviceRef/resetFault/", Lexium38iDiagnostics.resetFault);
motionMasterClientApiRouter.get("/api/getErrorAndWarningData", Lexium38iDiagnostics.getErrorAndWarningData);
motionMasterClientApiRouter.get("/api/getDeviceDiagnosticStatus", Lexium38iDiagnostics.getDeviceDiagnosticStatus);
motionMasterClientApiRouter.post("/api/devices/:deviceRef/releaseControl", ControlPanelApi.releaseControl);

motionMasterClientApiRouter.get("/devices/:deviceRef/getSystemIdentificationData", TuningApi.getSystemIdentificationData);
motionMasterClientApiRouter.get("/devices/:deviceRef/startSystemIdentification", TuningApi.startSystemIdentification);
motionMasterClientApiRouter.get("/devices/:deviceRef/getPositionTuningInfo", TuningApi.getPositionTuningInfo);
motionMasterClientApiRouter.get("/devices/:deviceRef/startPositionAutoTuning/:controllerType", TuningApi.startPositionAutoTuning);
motionMasterClientApiRouter.get("/devices/:deviceRef/getVelocityTuningInfo", TuningApi.getVelocityTuningInfo);
motionMasterClientApiRouter.get("/devices/:deviceRef/startVelocityAutoTuning/", TuningApi.startVelocityAutoTuning);
motionMasterClientApiRouter.get("/devices/:deviceRef/getTorqueTuningInfo", TuningApi.getTorqueTuningInfo);
motionMasterClientApiRouter.post("/devices/:deviceRef/computePositionGains", TuningApi.computePositionGains);
motionMasterClientApiRouter.post("/devices/:deviceRef/computeVelocityGains", TuningApi.computeVelocityGains);

motionMasterClientApiRouter.get("/devices/:deviceRef/getTuningTrajectoryInfo/profileType/:profileType", TuningTrajectoryApi.getTuningTrajectoryInfo);
motionMasterClientApiRouter.post("/devices/:deviceRef/startSignalGenerator", TuningTrajectoryApi.startSignalGenerator);
motionMasterClientApiRouter.post("/devices/:deviceRef/stopSignalGenerator", TuningTrajectoryApi.stopSignalGenerator);

/**
 * Get the current device status and send it in the response.
 */
motionMasterClientApiRouter.get("/api/getCia402StateOfDevice", Lexium38iDiagnostics.getCia402StateOfDevice);

export = motionMasterClientApiRouter;
