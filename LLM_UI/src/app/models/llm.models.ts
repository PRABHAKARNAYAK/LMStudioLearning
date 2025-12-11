
export interface LlmToolAnswer {
  answer: string;
  debug?: {
    first?: any;
    second?: any;
  };
}

export interface LlmChatToolsRequest {
  question: string;
}
