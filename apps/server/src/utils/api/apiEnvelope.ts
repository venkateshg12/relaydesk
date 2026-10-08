export type ApiEnvelope<T> = {
    status: 'success' | 'error';
    data: T | null;
    meta?: Record<string, unknown>;
    // `path` names the offending field for validation errors ("email", "members.0.name").
    errors?: Array<{ message: string, code?: string, path?: string }>;
}


export function ok<T>(data: T, meta?: Record<string, unknown>): ApiEnvelope<T> {
    return { status: 'success', data, meta };
}

export function fail(message: string, code?: string): ApiEnvelope<null> {
    return { status: "error", data: null, errors: [{ message, code }] };
}