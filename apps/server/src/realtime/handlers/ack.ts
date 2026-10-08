// Acks are optional on the wire (a client may omit the callback), so every handler replies through here.
export const reply = <T>(ack: ((response: T) => void) | undefined, response: T) => {
    if (typeof ack === "function") ack(response);
};
