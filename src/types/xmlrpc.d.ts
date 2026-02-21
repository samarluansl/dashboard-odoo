declare module 'xmlrpc' {
  interface Client {
    methodCall(
      method: string,
      params: unknown[],
      callback: (err: Error | null, result: unknown) => void
    ): void;
  }

  interface ClientOptions {
    host: string;
    port: number;
    path: string;
  }

  function createClient(options: ClientOptions): Client;
  function createSecureClient(options: ClientOptions): Client;

  export { Client, ClientOptions, createClient, createSecureClient };
}
