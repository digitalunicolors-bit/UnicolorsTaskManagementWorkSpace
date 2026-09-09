"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { useAuth } from "@/components/auth/auth-provider";

import {
  DashboardError,
  DashboardLoading,
} from "@/components/dashboard/dashboard-kit";

export default function DashboardRouterPage() {
  const router = useRouter();
  const { authFetch } = useAuth();

  const started = useRef(false);

  const [error, setError] =
    useState<string | null>(null);

  async function resolveDashboard() {
    setError(null);

    try {
        const superAdminResponse =
  await authFetch(
    "/dashboard/super-admin",
  );

if (superAdminResponse.ok) {
  router.replace(
    "/super-admin/dashboard",
  );
  return;
}

if (
  superAdminResponse.status === 401
) {
  throw new Error(
    "Your login session has expired. Please login again.",
  );
}

      const adminResponse =
        await authFetch(
          "/dashboard/admin",
        );

      if (adminResponse.ok) {
        router.replace(
          "/admin/dashboard",
        );
        return;
      }

      if (
        adminResponse.status === 401
      ) {
        throw new Error(
          "Your login session has expired. Please login again.",
        );
      }

      const managerResponse =
        await authFetch(
          "/dashboard/manager",
        );

      if (managerResponse.ok) {
        router.replace(
          "/manager/dashboard",
        );
        return;
      }

      if (
        managerResponse.status === 401
      ) {
        throw new Error(
          "Your login session has expired. Please login again.",
        );
      }

      const employeeResponse =
        await authFetch(
          "/dashboard/employee",
        );

      if (employeeResponse.ok) {
        router.replace(
          "/employee/dashboard",
        );
        return;
      }

      if (
        employeeResponse.status === 401
      ) {
        throw new Error(
          "Your login session has expired. Please login again.",
        );
      }

      throw new Error(
        "No dashboard is available for this account.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to identify your workspace.",
      );
    }
  }

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    void resolveDashboard();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <DashboardError
          message={error}
          onRetry={() => {
            started.current = false;
            void resolveDashboard();
          }}
        />
      </div>
    );
  }

  return (
    <DashboardLoading message="Opening your workspace..." />
  );
}
