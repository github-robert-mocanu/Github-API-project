import { Octokit } from "@octokit/core";
import dotenv from "dotenv";

console.log(dotenv.config);
class User {
  constructor(public name: string, public authCode: string) {}
}

class Project {
  id!: number; //id
  owner!: User;
  columns: Column[] = [];
  constructor(public name: string) {}

  addColumn(...inputColumns: Column[]) {
    inputColumns.forEach((column) => this.columns.push(column));
  }
}

class Column {
  id!: number;
  cards: Card[] = [];
  constructor(public name: string) {}

  addCard(...inputCard: Card[]) {
    inputCard.forEach((card) => this.cards.push(card));
  }
}

class Card {
  id!: number;
  constructor(public name: string, public note: string) {}
}

class Deploy {
  octokit: Octokit;

  constructor(public user: User) {
    this.octokit = new Octokit({
      auth: user.authCode,
    });
  }

  async deployProject(project: Project) {
    const info = await this.octokit.request("POST /user/projects", {
      name: project.name,
    });
    project.id = info.data.id;
    for (const column of project.columns) {
      await this.columnDep(column, project);
    }

    project.owner = this.user;
  }

  private async columnDep(column: Column, project: Project) {
    const info = await this.octokit.request(
      `POST /projects/${project.id}/columns`,
      {
        project_id: project.id,
        name: column.name,
      }
    );
    column.id = info.data.id;
    for (const card of column.cards) {
      await this.cardDep(card, column);
    }
  }

  private async cardDep(card: Card, column: Column) {
    const info = await this.octokit.request(
      `POST /projects/columns/${column.id}/cards`,
      {
        column_id: column.id,
        note: card.note,
      }
    );
    card.id = info.data.id;
    console.log(card.id);
  }
  async updateProject(project: Project) {
    const info = await this.octokit.request(
      `GET https://api.github.com/projects/${project.id}/columns`
    );
    for (let i = 0; i < project.columns.length; i++) {
      if (i < info.data.length) {
        await this.columnUp(project.columns[i]);
      } else {
        await this.columnDep(project.columns[i], project);
      }
    }
  }

  private async columnUp(column: Column) {
    const info = await this.octokit.request(
      `GET https://api.github.com/projects/columns/${column.id}/cards`
    );

    for (let i = 0; i < column.cards.length; i++) {
      if (i < info.data.length) {
        await this.cardUp(column.cards[i]);
      } else {
        await this.cardDep(column.cards[i], column);
      }
    }
  }

  private async cardUp(card: Card) {
    await this.octokit.request(`PATCH /projects/columns/cards/${card.id}`, {
      card_id: card.id,
      note: card.note,
    });
  }
}

const robert = new User("robert", "token");
const hello = new Project("Hello Project");

const column1 = new Column("To do");
const column2 = new Column("In progress");
const column3 = new Column("Done");

const card1 = new Card("Hey Column", "Hello there, hope it works");

column1.addCard(card1);
hello.addColumn(column1, column2, column3);
const deployRobert = new Deploy(robert);
(async function () {
  await deployRobert.deployProject(hello);
  await deployRobert.updateProject(hello);
})();

