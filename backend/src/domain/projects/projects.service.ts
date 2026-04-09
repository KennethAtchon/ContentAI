import type { IProjectsRepository } from "./projects.repository";
import { Errors } from "../../utils/errors/app-error";

export class ProjectsService {
  constructor(private readonly projectsRepo: IProjectsRepository) {}

  async listProjects(userId: string) {
    const projects = await this.projectsRepo.listProjects(userId);
    return { projects };
  }

  async createProject(
    userId: string,
    data: { name: string; description?: string },
  ) {
    const project = await this.projectsRepo.createProject({
      id: crypto.randomUUID(),
      userId,
      name: data.name,
      description: data.description,
    });

    return { project };
  }

  async getProject(userId: string, projectId: string) {
    const project = await this.projectsRepo.findById(projectId, userId);

    if (!project) {
      throw Errors.notFound("Project");
    }

    return { project };
  }

  async updateProject(
    userId: string,
    projectId: string,
    data: { name?: string; description?: string },
  ) {
    const updated = await this.projectsRepo.updateProject(
      projectId,
      userId,
      data,
    );

    if (!updated) {
      throw Errors.notFound("Project");
    }

    return { project: updated };
  }

  async deleteProject(userId: string, projectId: string) {
    const deleted = await this.projectsRepo.deleteProject(projectId, userId);

    if (!deleted) {
      throw Errors.notFound("Project");
    }

    return { success: true, message: "Project deleted successfully" };
  }
}
