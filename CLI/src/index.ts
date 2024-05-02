import { program } from 'commander';
import axios from 'axios';
import { API_URL } from './config';

program
  .name('grand-tour')
  .description('CLI tool for managing datasets')
  .version('0.0.1');

const list = program.command('list')
  .description('List resources');

list.command('files')
  .description('List all files with optional filters for project, run, or topics')
  .option('-p, --project <project>', 'Filter by project name')
  .option('-r, --run <run>', 'Filter by run name')
  .option('-t, --topics <topics...>', 'Filter by topics')
  .action(async (options) => {
    try {
      let url = `${API_URL}/file/filteredByNames`;


      const response = await axios.get(url, options);
      const runsByProjectUuid: { [uuid: string]: any[] } = {};
      const filesByRunUuid: { [uuid: string]: any[] } = {};
      response.data.forEach((file: any) => {
        const runuuid = file.run.uuid;
        const projectuuid = file.run.project.uuid;
        if(!runsByProjectUuid[projectuuid]) {
          runsByProjectUuid[projectuuid] = [];
        }
        if(!runsByProjectUuid[projectuuid].includes(runuuid)) {
          runsByProjectUuid[projectuuid].push(runuuid);
        }
        if(!filesByRunUuid[runuuid]) {
          filesByRunUuid[runuuid] = [];
        }
        filesByRunUuid[runuuid].push(file);
      });
      console.log('Files by Run & Project:');
      Object.keys(runsByProjectUuid).forEach((projectUuid) => {
        const runs = runsByProjectUuid[projectUuid];
        const firstFile = filesByRunUuid[runs[0]][0];
        console.log(`* ${firstFile.run.project.name}`);
        runs.forEach((run: any) => {
          console.log(`  - ${filesByRunUuid[run][0].run.name}`);
          filesByRunUuid[run].forEach((file: any) => {
            console.log(`    - ${file.filename}`);
          });
        });
      });

    } catch (error: any) {
      console.error('Failed to fetch runs:', error.message);
    }
  });

// List projects subcommand
list.command('projects')
  .description('List all projects')
  .action(async () => {

    try {
      const response = await axios.get(`${API_URL}/project`);
      console.log('Projects:');
      response.data.forEach((project: any) => {
        console.log(`- ${project.name}`);
      });
    } catch (error: any) {
      console.error('Failed to fetch projects:', error.message);
    }  });

// List runs subcommand
list.command('runs')
  .description('List all runs with optional filter for project')
  .option('-p, --project <project>', 'Filter by project name')
  .action(async (options: {project: string}) => {
    try {
      let url = `${API_URL}/run`;
      if(options.project) {
        url = url + `/filteredByProjectName/${options.project}`;
      }
      else {
        url = url + `/all`;
      }
      const response = await axios.get(url);
      const runsByProjectUuid: { [uuid: string]: any[] } = {};
      response.data.forEach((run: any) => {
        if(!runsByProjectUuid[run.project.uuid]) {
          runsByProjectUuid[run.project.uuid] = [];
        }
        runsByProjectUuid[run.project.uuid].push(run);
      });
      console.log('Runs by Project:');
      Object.keys(runsByProjectUuid).forEach((projectUuid) => {
        console.log(`* ${runsByProjectUuid[projectUuid][0].project.name}`);
        runsByProjectUuid[projectUuid].forEach((run: any) => {
          console.log(`  - ${run.name}`);
        });
      });

    } catch (error: any) {
      console.error('Failed to fetch runs:', error.message);
    }
  });

program.parse(process.argv);  // Parse the command line arguments
