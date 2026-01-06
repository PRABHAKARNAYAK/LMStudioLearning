export interface NodeProperty {
  Title: string;
  Description: string;
}

export interface NodeParameter {
  Index: string;
  SubIndex?: string; // Optional since it may not always be present
  readOnly?: boolean;
}

export interface NodeSubGroup {
  Title: string;
  Properties?: NodeProperty[]; // Optional
  Parameters: NodeParameter[];
}

export interface NodeGroup {
  Id: string;
  SubGroups: NodeSubGroup[];
}

export interface NodeGroups {
  [key: string]: NodeGroup; // Dynamic keys for group names
}
