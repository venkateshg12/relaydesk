// The slice of Google Identity Services (https://accounts.google.com/gsi/client) this app uses.
export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

interface GoogleIdConfiguration {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void;
  auto_select?: boolean;
  error_callback?: (error: unknown) => void;
}

interface GoogleButtonConfiguration {
  theme?: "outline" | "filled_blue" | "filled_black";
  size?: "large" | "medium" | "small";
  text?: "signin_with" | "signup_with" | "continue_with" | "signin";
  shape?: "rectangular" | "pill" | "circle" | "square";
  width?: number;
}

interface GoogleNamespace {
  accounts: {
    id: {
      initialize: (config: GoogleIdConfiguration) => void;
      renderButton: (parent: HTMLElement, options: GoogleButtonConfiguration) => void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleNamespace;
  }
}

export {};
