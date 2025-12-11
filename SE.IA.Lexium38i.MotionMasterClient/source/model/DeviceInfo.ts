import { Device } from "motion-master-client";

export enum DeviceStatus {
  Online = "Online",
  Offline = "Offline",
}

export interface DeviceInfo extends Device {
  status: DeviceStatus;
}
