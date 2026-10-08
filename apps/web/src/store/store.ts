import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import inboxUiReducer from "./slices/inboxUiSlice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      inboxUi: inboxUiReducer,
    },
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

let clientStore: AppStore | null = null;

export const setClientStore = (store: AppStore) => {
  clientStore = store;
};

export const getClientStore = (): AppStore | null => {
  return clientStore;
};
