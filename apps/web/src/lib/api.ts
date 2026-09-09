export type HealthResponse = {
  success: boolean;
  message: string;
  data: {
    service: string;
    status: string;
    environment: string;
    timestamp: string;
    uptime: number;
    dependencies: {
      database: string;
      redis: string;
      storage: string;
    };
  };
  meta: Record<string, unknown>;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:4000/api/v1';

export async function getApiHealth(): Promise<HealthResponse> {
  const response = await fetch(`${API_URL}/health`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `Health API returned status ${response.status}`,
    );
  }

  return (await response.json()) as HealthResponse;
}