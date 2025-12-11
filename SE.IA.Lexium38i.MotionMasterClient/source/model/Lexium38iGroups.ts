interface NodeProperty {
  Title: string;
  Description: string;
}

interface NodeParameter {
  Index: string;
  SubIndex?: string; // Optional since it may not always be present
  readOnly?: boolean;
}

interface NodeSubGroup {
  Title: string;
  Properties?: NodeProperty[]; // Optional
  Parameters: NodeParameter[];
}

interface NodeGroup {
  Id: string;
  SubGroups: NodeSubGroup[];
}

interface NodeGroups {
  [key: string]: NodeGroup; // Dynamic keys for group names
}
