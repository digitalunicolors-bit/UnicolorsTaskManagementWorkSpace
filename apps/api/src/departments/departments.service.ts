import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { hash } from 'bcryptjs';
import { randomBytes } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentPersonDto } from './dto/department-person.dto';

type PeopleInput = {
  head?: DepartmentPersonDto | null;
  members?: DepartmentPersonDto[];
};

@Injectable()
export class DepartmentsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async findAll() {
    return this.prisma.department.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        head: {
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            designation: true,
          },
        },
        _count: {
          select: {
            members: true,
            teams: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const department =
      await this.prisma.department.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          head: {
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              designation: true,
            },
          },
          members: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              employeeId: true,
              username: true,
              fullName: true,
              designation: true,
              employmentStatus: true,
              user: {
                select: {
                  email: true,
                  phone: true,
                  isActive: true,
                  mustChangePassword: true,
                },
              },
            },
            orderBy: {
              fullName: 'asc',
            },
          },
          teams: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              isActive: true,
            },
          },
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found.',
      );
    }

    return department;
  }

  private cleanName(value?: string | null) {
    return value?.trim().replace(/\s+/g, ' ') || '';
  }

  private normalizeUsername(
    value?: string | null,
  ) {
    const username =
      value
        ?.trim()
        .replace(/^@+/, '')
        .toLowerCase() || '';

    if (!username) {
      return '';
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        username,
      )
    ) {
      throw new BadRequestException(
        'Username must be 3-30 characters and can only contain letters, numbers, dot, underscore and hyphen.',
      );
    }

    return username;
  }

  private normalizeEmail(
    value?: string | null,
  ) {
    return value?.trim().toLowerCase() || '';
  }

  private normalizePhone(
    value?: string | null,
  ) {
    return value?.trim() || '';
  }

  private async getRole(
    tx: Prisma.TransactionClient,
    roleName: 'MANAGER' | 'EMPLOYEE',
  ) {
    const role = await tx.role.findFirst({
      where: {
        name: roleName,
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (!role) {
      throw new BadRequestException(
        `${roleName} role is not configured.`,
      );
    }

    return role;
  }

  private async ensureRole(
    tx: Prisma.TransactionClient,
    userId: string,
    roleName: 'MANAGER' | 'EMPLOYEE',
  ) {
    const role = await this.getRole(
      tx,
      roleName,
    );

    const existing =
      await tx.userRole.findFirst({
        where: {
          userId,
          roleId: role.id,
        },
        select: {
          id: true,
        },
      });

    if (!existing) {
      await tx.userRole.create({
        data: {
          userId,
          roleId: role.id,
        },
      });
    }
  }

  private async validateExistingEmployee(
    tx: Prisma.TransactionClient,
    employeeId: string,
  ) {
    const employee =
      await tx.employeeProfile.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
        },
        select: {
          id: true,
          userId: true,
          fullName: true,
          departmentId: true,
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Selected employee was not found.',
      );
    }

    return employee;
  }

  private async assertNewPersonIsUnique(
    tx: Prisma.TransactionClient,
    input: {
      fullName: string;
      username: string;
      email: string;
      phone: string;
    },
  ) {
    const sameName =
      await tx.employeeProfile.findFirst({
        where: {
          deletedAt: null,
          fullName: {
            equals: input.fullName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

    if (sameName) {
      throw new ConflictException(
        `${input.fullName} already exists. Select the existing person from the suggestions.`,
      );
    }

    const usernameExists =
      await tx.employeeProfile.findUnique({
        where: {
          username: input.username,
        },
        select: {
          id: true,
        },
      });

    if (usernameExists) {
      throw new ConflictException(
        'Username already exists.',
      );
    }

    if (input.email) {
      const emailExists =
        await tx.user.findUnique({
          where: {
            email: input.email,
          },
          select: {
            id: true,
          },
        });

      if (emailExists) {
        throw new ConflictException(
          'Email address already exists.',
        );
      }
    }

    if (input.phone) {
      const phoneExists =
        await tx.user.findUnique({
          where: {
            phone: input.phone,
          },
          select: {
            id: true,
          },
        });

      if (phoneExists) {
        throw new ConflictException(
          'Phone number already exists.',
        );
      }
    }
  }

  private async createWorkspaceEmployee(
    tx: Prisma.TransactionClient,
    person: DepartmentPersonDto,
    roleName: 'MANAGER' | 'EMPLOYEE',
    departmentId: string,
    reportingManagerId: string | null,
  ) {
    const fullName = this.cleanName(
      person.fullName,
    );
    const email = this.normalizeEmail(
      person.email,
    );
    const phone = this.normalizePhone(
      person.phone,
    );
    const username =
      this.normalizeUsername(
        person.username,
      );
    const temporaryPassword =
      person.temporaryPassword?.trim() ||
      '';

    if (!fullName) {
      throw new BadRequestException(
        'Name is required for a new user.',
      );
    }

    if (!email && !phone) {
      throw new BadRequestException(
        `${fullName}: email or phone number is required.`,
      );
    }

    if (!username) {
      throw new BadRequestException(
        `${fullName}: username is required.`,
      );
    }

    if (temporaryPassword.length < 8) {
      throw new BadRequestException(
        `${fullName}: temporary password must contain at least 8 characters.`,
      );
    }

    await this.assertNewPersonIsUnique(
      tx,
      {
        fullName,
        username,
        email,
        phone,
      },
    );

    const role = await this.getRole(
      tx,
      roleName,
    );

    const suffix = randomBytes(4)
      .toString('hex')
      .toUpperCase();

    const employeeId = `UC-${suffix}`;

    const passwordHash = await hash(
      temporaryPassword,
      12,
    );

    const user = await tx.user.create({
      data: {
        email: email || null,
        phone: phone || null,
        passwordHash,
        isActive: true,
        mustChangePassword: true,
        roles: {
          create: {
            roleId: role.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    return tx.employeeProfile.create({
      data: {
        userId: user.id,
        employeeId,
        username,
        fullName,
        designation:
          roleName === 'MANAGER'
            ? 'HOD'
            : null,
        departmentId,
        reportingManagerId,
      },
      select: {
        id: true,
        userId: true,
        fullName: true,
        departmentId: true,
      },
    });
  }

  private async resolveOrCreatePerson(
    tx: Prisma.TransactionClient,
    options: {
      person: DepartmentPersonDto;
      roleName: 'MANAGER' | 'EMPLOYEE';
      departmentId: string;
      reportingManagerId: string | null;
    },
  ) {
    if (options.person.employeeId?.trim()) {
      const employee =
        await this.validateExistingEmployee(
          tx,
          options.person.employeeId.trim(),
        );

      if (
        options.roleName === 'MANAGER'
      ) {
        await this.ensureRole(
          tx,
          employee.userId,
          'MANAGER',
        );
      }

      return employee;
    }

    const fullName = this.cleanName(
      options.person.fullName,
    );

    if (fullName) {
      const exactMatches =
        await tx.employeeProfile.findMany({
          where: {
            deletedAt: null,
            fullName: {
              equals: fullName,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            userId: true,
            fullName: true,
            departmentId: true,
          },
          take: 2,
        });

      if (exactMatches.length === 1) {
        const existing = exactMatches[0];

        if (options.roleName === 'MANAGER') {
          await this.ensureRole(
            tx,
            existing.userId,
            'MANAGER',
          );
        }

        return existing;
      }
    }

    return this.createWorkspaceEmployee(
      tx,
      options.person,
      options.roleName,
      options.departmentId,
      options.reportingManagerId,
    );
  }

  private async syncDepartmentPeople(
    tx: Prisma.TransactionClient,
    departmentId: string,
    input: PeopleInput,
  ) {
    let headId: string | null = null;

    if (input.head) {
      const head =
        await this.resolveOrCreatePerson(
          tx,
          {
            person: input.head,
            roleName: 'MANAGER',
            departmentId,
            reportingManagerId: null,
          },
        );

      headId = head.id;

      await tx.employeeProfile.update({
        where: {
          id: head.id,
        },
        data: {
          designation: 'HOD',
          ...(!head.departmentId
            ? {
                departmentId,
                reportingManagerId: null,
              }
            : head.departmentId === departmentId
              ? {
                  reportingManagerId: null,
                }
              : {}),
        },
      });
    }

    const resolvedMemberIds: string[] = [];

    for (const person of input.members ?? []) {
      const member =
        await this.resolveOrCreatePerson(
          tx,
          {
            person,
            roleName: 'EMPLOYEE',
            departmentId,
            reportingManagerId: headId,
          },
        );

      if (member.id !== headId) {
        resolvedMemberIds.push(
          member.id,
        );
      }
    }

    const assignedIds = Array.from(
      new Set([
        ...resolvedMemberIds,
        ...(headId ? [headId] : []),
      ]),
    );

    const currentMembers =
      await tx.employeeProfile.findMany({
        where: {
          departmentId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    const currentIds =
      currentMembers.map(
        (item) => item.id,
      );

    const removedIds =
      currentIds.filter(
        (id) => !assignedIds.includes(id),
      );

    if (removedIds.length) {
      await tx.employeeProfile.updateMany({
        where: {
          id: {
            in: removedIds,
          },
        },
        data: {
          departmentId: null,
          reportingManagerId: null,
        },
      });
    }

    if (resolvedMemberIds.length) {
      await tx.employeeProfile.updateMany({
        where: {
          id: {
            in: resolvedMemberIds,
          },
        },
        data: {
          departmentId,
          reportingManagerId: headId,
        },
      });
    }

    await tx.department.update({
      where: {
        id: departmentId,
      },
      data: {
        headId,
      },
    });
  }

  async create(
    dto: CreateDepartmentDto,
  ) {
    const name = dto.name.trim();

    const existing =
      await this.prisma.department.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          deletedAt: true,
          isActive: true,
        },
      });

    if (existing?.deletedAt === null) {
      throw new ConflictException(
        'Department already exists.',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const department = existing
          ? await tx.department.update({
              where: {
                id: existing.id,
              },
              data: {
                name,
                isActive: true,
                deletedAt: null,
                headId: null,
              },
            })
          : await tx.department.create({
              data: {
                name,
              },
            });

        await this.syncDepartmentPeople(
          tx,
          department.id,
          dto,
        );

        return {
          departmentId: department.id,
        };
      },
    );

    const department = await this.findOne(
      result.departmentId,
    );

    return department;
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    await this.findOne(id);

    if (dto.name !== undefined) {
      const duplicate =
        await this.prisma.department.findFirst({
          where: {
            id: {
              not: id,
            },
            deletedAt: null,
            name: {
              equals: dto.name.trim(),
              mode: 'insensitive',
            },
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'Department already exists.',
        );
      }
    }

    const shouldSyncPeople =
      dto.head !== undefined ||
      dto.members !== undefined;

    await this.prisma.$transaction(
      async (tx) => {
        await tx.department.update({
          where: {
            id,
          },
          data: {
            ...(dto.name !== undefined && {
              name: dto.name.trim(),
            }),
            ...(dto.isActive !== undefined && {
              isActive: dto.isActive,
            }),
          },
        });

        if (shouldSyncPeople) {
          await this.syncDepartmentPeople(
            tx,
            id,
            dto,
          );
        }
      },
    );

    const department = await this.findOne(id);

    return department;
  }

  async remove(id: string) {
    await this.findOne(id);

    const [activeEmployees, activeTeams] =
      await Promise.all([
        this.prisma.employeeProfile.count({
          where: {
            departmentId: id,
            deletedAt: null,
          },
        }),
        this.prisma.team.count({
          where: {
            departmentId: id,
            deletedAt: null,
          },
        }),
      ]);

    if (
      activeEmployees > 0 ||
      activeTeams > 0
    ) {
      throw new ConflictException(
        'Reassign department employees and teams before deleting this department.',
      );
    }

    await this.prisma.department.update({
      where: {
        id,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });

    return {
      success: true,
      message:
        'Department removed successfully.',
    };
  }
}
