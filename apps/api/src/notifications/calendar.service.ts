import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface CalendarQuery {
  start?: string;
  end?: string;
  employeeId?: string;
  clientId?: string;
  projectId?: string;
  departmentId?: string;
  priority?: string;
}

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value: string | undefined, fallback: Date) {
    if (!value) return fallback;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed;
  }

  private async identity(userId: string) {
    const [roles, employee] = await Promise.all([
      this.prisma.userRole.findMany({
        where: { userId },
        select: { role: { select: { name: true } } },
      }),
      this.prisma.employeeProfile.findFirst({
        where: { userId, deletedAt: null },
        select: { id: true, departmentId: true },
      }),
    ]);

    return {
      roles: roles.map((item) => item.role.name),
      employeeId: employee?.id ?? null,
      departmentId: employee?.departmentId ?? null,
    };
  }

  private async taskScope(userId: string): Promise<any> {
    const identity = await this.identity(userId);

    if (
      identity.roles.includes('SUPER_ADMIN') ||
      identity.roles.includes('ADMIN')
    ) {
      return {};
    }

    if (!identity.employeeId) return { id: '__NO_ACCESS__' };

    if (identity.roles.includes('MANAGER')) {
      const directReports = await this.prisma.employeeProfile.findMany({
        where: {
          reportingManagerId: identity.employeeId,
          deletedAt: null,
        },
        select: { id: true },
      });

      const teamIds = [
        identity.employeeId,
        ...directReports.map((item) => item.id),
      ];

      return {
        OR: [
          { project: { projectManagerId: identity.employeeId } },
          {
            assignees: {
              some: { employeeId: { in: teamIds }, removedAt: null },
            },
          },
          {
            collaborators: {
              some: { employeeId: { in: teamIds }, removedAt: null },
            },
          },
          { reviewers: { some: { employeeId: identity.employeeId } } },
        ],
      };
    }

    return {
      OR: [
        {
          assignees: {
            some: { employeeId: identity.employeeId, removedAt: null },
          },
        },
        {
          collaborators: {
            some: { employeeId: identity.employeeId, removedAt: null },
          },
        },
      ],
    };
  }

  private async projectScope(userId: string): Promise<any> {
    const identity = await this.identity(userId);

    if (
      identity.roles.includes('SUPER_ADMIN') ||
      identity.roles.includes('ADMIN')
    ) {
      return {};
    }

    if (!identity.employeeId) return { id: '__NO_ACCESS__' };

    return {
      OR: [
        { projectManagerId: identity.employeeId },
        {
          members: {
            some: {
              employeeId: identity.employeeId,
              isActive: true,
              leftAt: null,
            },
          },
        },
        {
          tasks: {
            some: {
              deletedAt: null,
              OR: [
                {
                  assignees: {
                    some: {
                      employeeId: identity.employeeId,
                      removedAt: null,
                    },
                  },
                },
                {
                  collaborators: {
                    some: {
                      employeeId: identity.employeeId,
                      removedAt: null,
                    },
                  },
                },
                { reviewers: { some: { employeeId: identity.employeeId } } },
              ],
            },
          },
        },
      ],
    };
  }

  async getOptions(userId: string) {
    const identity = await this.identity(userId);
    const projectScope = await this.projectScope(userId);

    const [projects, departments] = await Promise.all([
      this.prisma.project.findMany({
        where: { deletedAt: null, ...projectScope },
        select: {
          id: true,
          name: true,
          clientId: true,
          client: { select: { id: true, name: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { deletedAt: null, isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const clientMap = new Map<string, { id: string; name: string }>();
    for (const project of projects) clientMap.set(project.client.id, project.client);

    let employeeWhere: any = {
      deletedAt: null,
      employmentStatus: 'ACTIVE',
    };

    if (
      !identity.roles.includes('SUPER_ADMIN') &&
      !identity.roles.includes('ADMIN')
    ) {
      if (!identity.employeeId) {
        employeeWhere = { id: '__NO_ACCESS__' };
      } else if (identity.roles.includes('MANAGER')) {
        employeeWhere = {
          deletedAt: null,
          OR: [
            { id: identity.employeeId },
            { reportingManagerId: identity.employeeId },
          ],
        };
      } else {
        employeeWhere = { id: identity.employeeId, deletedAt: null };
      }
    }

    const employees = await this.prisma.employeeProfile.findMany({
      where: employeeWhere,
      select: {
        id: true,
        fullName: true,
        username: true,
        departmentId: true,
        employmentStatus: true,
      },
      orderBy: { fullName: 'asc' },
    });

    return {
      clients: [...clientMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
      projects: projects.map(({ client, ...project }) => project),
      departments,
      employees,
      priorities: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    };
  }

  async getEvents(userId: string, query: CalendarQuery) {
    const now = new Date();
    const fallbackStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fallbackEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const start = this.date(query.start, fallbackStart);
    const end = this.date(query.end, fallbackEnd);

    const taskScope = await this.taskScope(userId);
    const projectScope = await this.projectScope(userId);

    const taskFilters: any = {
      deletedAt: null,
      isDraft: false,
      dueAt: { gte: start, lt: end },
      ...taskScope,
    };

    if (query.employeeId) {
      taskFilters.assignees = {
        some: { employeeId: query.employeeId, removedAt: null },
      };
    }
    if (query.clientId) taskFilters.clientId = query.clientId;
    if (query.projectId) taskFilters.projectId = query.projectId;
    if (query.departmentId) taskFilters.departmentId = query.departmentId;
    if (query.priority) taskFilters.priority = query.priority;

    const projectExtra: any = {};
    if (query.clientId) projectExtra.clientId = query.clientId;
    if (query.projectId) projectExtra.id = query.projectId;
    if (query.departmentId) projectExtra.departmentId = query.departmentId;
    if (query.priority) projectExtra.priority = query.priority;
    if (query.employeeId) {
      projectExtra.OR = [
        { projectManagerId: query.employeeId },
        {
          members: {
            some: {
              employeeId: query.employeeId,
              isActive: true,
              leftAt: null,
            },
          },
        },
      ];
    }

    const projectFilters: any = {
      AND: [
        { deletedAt: null, deadline: { gte: start, lt: end } },
        projectScope,
        projectExtra,
      ],
    };

    const milestoneProjectFilter: any = {
      AND: [projectScope, projectExtra, { deletedAt: null }],
    };

    const recurringTemplateExtra: any = {};
    if (query.clientId) recurringTemplateExtra.clientId = query.clientId;
    if (query.projectId) recurringTemplateExtra.projectId = query.projectId;
    if (query.departmentId) recurringTemplateExtra.departmentId = query.departmentId;
    if (query.priority) recurringTemplateExtra.priority = query.priority;
    if (query.employeeId) {
      recurringTemplateExtra.assignees = {
        some: { employeeId: query.employeeId, removedAt: null },
      };
    }

    const [tasks, projects, milestones, recurring] = await Promise.all([
      this.prisma.task.findMany({
        where: taskFilters,
        select: {
          id: true,
          title: true,
          dueAt: true,
          priority: true,
          isCritical: true,
          client: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          status: { select: { code: true, name: true, color: true } },
          assignees: {
            where: { removedAt: null },
            select: {
              employee: {
                select: { id: true, fullName: true, username: true },
              },
            },
          },
        },
        orderBy: { dueAt: 'asc' },
      }),
      this.prisma.project.findMany({
        where: projectFilters,
        select: {
          id: true,
          name: true,
          deadline: true,
          priority: true,
          client: { select: { id: true, name: true } },
          department: { select: { id: true, name: true } },
          projectManager: { select: { id: true, fullName: true } },
        },
        orderBy: { deadline: 'asc' },
      }),
      this.prisma.projectMilestone.findMany({
        where: {
          deletedAt: null,
          dueDate: { gte: start, lt: end },
          project: milestoneProjectFilter,
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          project: {
            select: {
              id: true,
              name: true,
              client: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.recurringTask.findMany({
        where: {
          deletedAt: null,
          isActive: true,
          nextRunAt: { gte: start, lt: end },
          templateTask: {
            AND: [{ deletedAt: null }, taskScope, recurringTemplateExtra],
          },
        },
        select: {
          id: true,
          frequency: true,
          interval: true,
          nextRunAt: true,
          templateTask: {
            select: {
              id: true,
              title: true,
              priority: true,
              client: { select: { id: true, name: true } },
              project: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { nextRunAt: 'asc' },
      }),

    ]);

    const events: any[] = [];

    for (const task of tasks) {
      if (!task.dueAt) continue;
      events.push({
        id: `task:${task.id}`,
        type: 'TASK',
        title: task.title,
        date: task.dueAt.toISOString(),
        priority: task.priority,
        critical: task.isCritical,
        client: task.client,
        project: task.project,
        department: task.department,
        status: task.status,
        assignees: task.assignees.map((item) => item.employee),
        redirectPath: `/tasks?task=${task.id}`,
      });
    }

    for (const project of projects) {
      if (!project.deadline) continue;
      events.push({
        id: `project:${project.id}`,
        type: 'PROJECT_DEADLINE',
        title: project.name,
        date: project.deadline.toISOString(),
        priority: project.priority,
        client: project.client,
        department: project.department,
        manager: project.projectManager,
        redirectPath: `/projects?project=${project.id}`,
      });
    }

    for (const milestone of milestones) {
      if (!milestone.dueDate) continue;
      events.push({
        id: `milestone:${milestone.id}`,
        type: 'MILESTONE',
        title: milestone.title,
        date: milestone.dueDate.toISOString(),
        status: milestone.status,
        project: milestone.project,
        client: milestone.project.client,
        redirectPath: `/projects?project=${milestone.project.id}`,
      });
    }

    for (const rule of recurring) {
      if (!rule.nextRunAt) continue;
      events.push({
        id: `recurring:${rule.id}`,
        type: 'RECURRING',
        title: rule.templateTask.title,
        date: rule.nextRunAt.toISOString(),
        frequency: rule.frequency,
        interval: rule.interval,
        priority: rule.templateTask.priority,
        client: rule.templateTask.client,
        project: rule.templateTask.project,
        redirectPath: `/tasks?task=${rule.templateTask.id}`,
      });
    }

    events.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    return {
      start: start.toISOString(),
      end: end.toISOString(),
      events,
    };
  }
}
