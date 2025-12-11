import express from "express";
import { StartDiscovery } from "../controllers/StartDiscovery";

const startDiscoveryRoute = express.Router();
startDiscoveryRoute.use(express.json({ limit: "10mb" }));
startDiscoveryRoute.use(express.urlencoded({ extended: false }));
StartDiscovery.init();

//To Do: Remove the macAddress from the url as settings are retrieved from the repository.
startDiscoveryRoute.post(
  "/discoverDevices/:macAddress",
  StartDiscovery.getInstance().StartDeviceDiscovery
);

export = startDiscoveryRoute;
