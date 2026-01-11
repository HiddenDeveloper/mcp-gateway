/**
 * Dashboard PM2 Status Handler
 *
 * Fetches PM2 process information via `pm2 jlist`
 */

interface PM2Response {
  timestamp: string;
  processes: Array<{
    name: string;
    status: string;
    uptime: number;
    restarts: number;
    cpu: number;
    memory_mb: number;
  }>;
}

export async function getPM2Status(params: any): Promise<PM2Response> {
  const timestamp = new Date().toISOString();

  try {
    // Execute pm2 jlist command
    const proc = Bun.spawn(["pm2", "jlist"], {
      stdout: "pipe",
      stderr: "pipe"
    });

    const output = await new Response(proc.stdout).text();
    const pm2Data = JSON.parse(output);

    const processes = pm2Data.map((proc: any) => ({
      name: proc.name,
      status: proc.pm2_env?.status || "unknown",
      uptime: proc.pm2_env?.pm_uptime ? Math.floor((Date.now() - proc.pm2_env.pm_uptime) / 1000) : 0,
      restarts: proc.pm2_env?.restart_time || 0,
      cpu: proc.monit?.cpu || 0,
      memory_mb: proc.monit?.memory ? Math.round(proc.monit.memory / 1024 / 1024 * 10) / 10 : 0
    }));

    return {
      timestamp,
      processes
    };
  } catch (error) {
    console.error("Error fetching PM2 status:", error);

    return {
      timestamp,
      processes: []
    };
  }
}
