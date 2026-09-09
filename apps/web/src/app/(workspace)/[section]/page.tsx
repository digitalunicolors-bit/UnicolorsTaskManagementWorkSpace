import { notFound } from 'next/navigation';

const sections: Record<
  string,
  {
    title: string;
    description: string;
  }
> = {
  tasks: {
    title: 'Tasks',
    description:
      'Create, assign, review and track team tasks.',
  },

  projects: {
    title: 'Projects',
    description:
      'Manage projects, milestones and project teams.',
  },

  clients: {
    title: 'Clients',
    description:
      'Manage clients, contacts and account ownership.',
  },

  team: {
    title: 'Team',
    description:
      'Manage employees, departments and teams.',
  },

  calendar: {
    title: 'Calendar',
    description:
      'Track deadlines, schedules and upcoming work.',
  },

  reports: {
    title: 'Reports',
    description:
      'View productivity and operational reports.',
  },

  notifications: {
    title: 'Notifications',
    description:
      'View task and workspace notifications.',
  },

  settings: {
    title: 'Settings',
    description:
      'Configure workspace and account settings.',
  },
};

export default async function SectionPage({
  params,
}: {
  params: Promise<{
    section: string;
  }>;
}) {
  const { section } = await params;

  const page = sections[section];

  if (!page) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
        {page.title}
      </h1>

    </div>
  );
}