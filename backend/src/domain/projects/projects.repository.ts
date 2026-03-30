import { eq, and, desc } from "drizzle-orm";
import { projects } from "../../infrastructure/database/drizzle/schema";
import type { AppDb } from "../database.types";

export interface IProjectsRepository {
  listProjects(userId: string): Promise<
    {
      id: string;
      name: string;
      description: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[]
  >;

  findById(
    projectId: string,
    userId: string,
  ): Promise<
    | {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined
  >;

  createProject(data: {
    id: string;
    userId: string;
    name: string;
    description?: string;
  }): Promise<{
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;

  updateProject(
    projectId: string,
    userId: string,
    data: {
      name?: string;
      description?: string;
    },
  ): Promise<
    | {
        id: string;
        name: string;
        description: string | null;
        createdAt: Date;
        updatedAt: Date;
      }
    | undefined
  >;

  deleteProject(projectId: string, userId: string): Promise<boolean>;
}

export class ProjectsRepository implements IProjectsRepository {
  constructor(private readonly db: AppDb) {}

  async listProjects(userId: string) {
    return this.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(eq(projects.userId, userId))
      .orderBy(desc(projects.updatedAt));
  }

  async findById(projectId: string, userId: string) {
    const [project] = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .limit(1);

    return project;
  }

  async createProject(data: {
    id: string;
    userId: string;
    name: string;
    description?: string;
  }) {
    const [newProject] = await this.db
      .insert(projects)
      .values({
        id: data.id,
        userId: data.userId,
        name: data.name,
        description: data.description,
      })
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      });

    if (!newProject) {
      throw new Error("Failed to create project");
    }

    return newProject;
  }

  async updateProject(
    projectId: string,
    userId: string,
    data: { name?: string; description?: string },
  ) {
    const [updated] = await this.db
      .update(projects)
      .set(data)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      });

    return updated;
  }

  async deleteProject(projectId: string, userId: string): Promise<boolean> {
    const deleted = await this.db
      .delete(projects)
      .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
      .returning({ id: projects.id });

    return deleted.length > 0;
  }
}
