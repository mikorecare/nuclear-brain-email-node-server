export type ICallback = (...args: any[]) => void;
export type IModelNames = "audiences" | "businesses" | "businessInfos" | "recipients" | "statistics" | "templates" | "users" | "segments" | "";

export interface IDatabaseResponse {
  result: any[] | any;
  message: string;
  error: boolean;
}

export interface IRoutesResponse {
  status: string | number;
  message: string;
  data: any[];
  meta: {
    version?: number;
    total?: number;
  };
}

export interface IValidationError {
  hasError: boolean;
  name?: string;
  value?: any;
  message?: any;
}

export interface ICsvUpdateQuery {
  unSub: (isSub: boolean) => any;
  subscribed: any;
  isSub: boolean;
  update: any;
  subscribedArray: any;
}
