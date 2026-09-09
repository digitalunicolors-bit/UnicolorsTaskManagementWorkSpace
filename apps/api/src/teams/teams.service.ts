import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { TeamMembersDto } from './dto/team-members.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private async validateDepartment(
    departmentId: string,
  ) {
    const department =
      await this.prisma.department.findFirst({
        where: {
          id: departmentId,
          deletedAt: null,
          isActive: true,
        },
      });

    if (!department) {
      throw new NotFoundException(
        'Department not found.',
      );
    }
  }

  private async validateEmployee(
    employeeId?: string | null,
  ) {
    if (!employeeId) return;

    const employee =
      await this.prisma.employeeProfile.findFirst({
        where: {
          id: employeeId,
          deletedAt: null,
        },
      });

    if (!employee) {
      throw new NotFoundException(
        'Employee not found.',
      );
    }
  }

  private async validateEmployees(
    employeeIds: string[],
  ) {
    const uniqueIds = [
      ...new Set(employeeIds),
    ];

    const employees =
      await this.prisma.employeeProfile.findMany({
        where: {
          id: {
            in: uniqueIds,
          },
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

    if (
      employees.length !==
      uniqueIds.length
    ) {
      throw new NotFoundException(
        'One or more employees were not found.',
      );
    }

    return uniqueIds;
  }

  async findAll() {
    return this.prisma.team.findMany({
      where: {
        deletedAt: null,
      },

      include: {
        department: {
          select: {
            id: true,
            name: true,
          },
        },

        lead: {
          select: {
            id: true,
            employeeId: true,
            fullName: true,
            designation: true,
          },
        },

        members: {
          where: {
            leftAt: null,
          },
          include: {
            employee: {
              select: {
                id: true,
                employeeId: true,
                fullName: true,
                designation: true,
                employmentStatus: true,
              },
            },
          },
        },
      },

      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const team =
      await this.prisma.team.findFirst({
        where: {
          id,
          deletedAt: null,
        },

        include: {
          department: true,

          lead: {
            select: {
              id: true,
              employeeId: true,
              fullName: true,
              designation: true,
            },
          },

          members: {
            where: {
              leftAt: null,
            },
            include: {
              employee: {
                include: {
                  user: {
                    select: {
                      email: true,
                      phone: true,
                      isActive: true,
                    },
                  },
                },
              },
            },
            orderBy: {
              joinedAt: 'asc',
            },
          },
        },
      });

    if (!team) {
      throw new NotFoundException(
        'Team not found.',
      );
    }

    return team;
  }

  async create(
    dto: CreateTeamDto,
  ) {
    const name = dto.name.trim();
    const departmentId =
      dto.departmentId.trim();

    await this.validateDepartment(
      departmentId,
    );

    if (dto.leadId?.trim()) {
      await this.validateEmployee(
        dto.leadId.trim(),
      );
    }

    const duplicate =
      await this.prisma.team.findFirst({
        where: {
          departmentId,
          name: {
            equals: name,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });

    if (duplicate) {
      throw new ConflictException(
        'A team with this name already exists in the department.',
      );
    }

    const memberIds =
      dto.memberIds?.length
        ? await this.validateEmployees(
            dto.memberIds,
          )
        : [];

    const team =
      await this.prisma.team.create({
        data: {
          name,
          description:
            dto.description?.trim() ||
            null,
          departmentId,
          leadId:
            dto.leadId?.trim() ||
            null,

          members: {
            create: memberIds.map(
              (employeeId) => ({
                employeeId,
              }),
            ),
          },
        },
      });

    return this.findOne(team.id);
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
  ) {
    const existing =
      await this.findOne(id);

    const departmentId =
      dto.departmentId !== undefined
        ? dto.departmentId.trim()
        : existing.departmentId;

    if (
      dto.departmentId !== undefined
    ) {
      await this.validateDepartment(
        departmentId,
      );
    }

    if (
      dto.leadId !== undefined &&
      dto.leadId.trim()
    ) {
      await this.validateEmployee(
        dto.leadId.trim(),
      );
    }

    if (
      dto.name !== undefined ||
      dto.departmentId !== undefined
    ) {
      const name =
        dto.name?.trim() ??
        existing.name;

      const duplicate =
        await this.prisma.team.findFirst({
          where: {
            id: {
              not: id,
            },
            departmentId,
            deletedAt: null,
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
        });

      if (duplicate) {
        throw new ConflictException(
          'A team with this name already exists in the department.',
        );
      }
    }

    await this.prisma.team.update({
      where: {
        id,
      },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim(),
        }),

        ...(dto.description !==
          undefined && {
          description:
            dto.description.trim() ||
            null,
        }),

        ...(dto.departmentId !==
          undefined && {
          departmentId,
        }),

        ...(dto.leadId !== undefined && {
          leadId:
            dto.leadId.trim() ||
            null,
        }),

        ...(dto.isActive !==
          undefined && {
          isActive: dto.isActive,
        }),
      },
    });

    return this.findOne(id);
  }

  async addMembers(
    id: string,
    dto: TeamMembersDto,
  ) {
    await this.findOne(id);

    const employeeIds =
      await this.validateEmployees(
        dto.employeeIds,
      );

    await this.prisma.$transaction(
      employeeIds.map((employeeId) =>
        this.prisma.teamMember.upsert({
          where: {
            teamId_employeeId: {
              teamId: id,
              employeeId,
            },
          },

          update: {
            leftAt: null,
            joinedAt: new Date(),
          },

          create: {
            teamId: id,
            employeeId,
          },
        }),
      ),
    );

    return this.findOne(id);
  }

  async removeMembers(
    id: string,
    dto: TeamMembersDto,
  ) {
    await this.findOne(id);

    await this.prisma.teamMember.updateMany({
      where: {
        teamId: id,
        employeeId: {
          in: dto.employeeIds,
        },
        leftAt: null,
      },
      data: {
        leftAt: new Date(),
      },
    });

    return this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);

    const now = new Date();

    await this.prisma.$transaction([
      this.prisma.team.update({
        where: {
          id,
        },
        data: {
          isActive: false,
          deletedAt: now,
        },
      }),

      this.prisma.teamMember.updateMany({
        where: {
          teamId: id,
          leftAt: null,
        },
        data: {
          leftAt: now,
        },
      }),
    ]);

    return {
      success: true,
      message:
        'Team removed successfully.',
    };
  }
}