import { program } from 'commander';
import axios from 'axios';
import { API_URL } from './config';
import path from 'path';

program
  .name('grand-tour')
  .description('CLI tool for managing datasets')
  .version('0.0.1');

const list = program.command('list')
  .description('List resources');

const create = program.command('create').description('Create resources');

list.command('files')
  .description('List all files with optional filters for project, run, or topics')
  .option('-p, --project <project>', 'Filter by project name')
  .option('-r, --run <run>', 'Filter by run name')
  .option('-t, --topics <topics...>', 'Filter by topics')
  .action(async (options) => {
    try {
      let url = `${API_URL}/file/filteredByNames`;


      const response = await axios.get(url, {params:{
        projectName: options.project,
        runName: options.run,
          topics: options.topics,
        }});
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

create.command('project <name>')
  .description('Create a project')
  .action(async (name) => {
    try {
      const res = await axios.post(`${API_URL}/project/create`, {name});
      console.log(`Project created with UUID: ${res.data.uuid}`);
    }
    catch (error: any) {
      console.error('Failed to create project:', error.message);
    }
  })

create.command('run <name> <projectname>')
  .description('Create a run for a project')
  .action(async (name, projectname) => {
    try {
      const project = await axios.get(`${API_URL}/project/byName`,{params: {name: projectname}});
      if(!project.data) {
        console.error(`Project with name ${projectname} not found`);
        return;
      }
      const res = await axios.post(`${API_URL}/run/create`, {name, projectUUID: project.data.uuid});
      console.log(`Run created with UUID: ${res.data.uuid}`);
    }
    catch (error: any) {
      console.error('Failed to create run:', error.message);
    }
  })

const upload = program.command('upload <files...> <runname>')
  .description('Upload one or more files')
  .option('-j, --parallel <count>', 'Parallel uploads, default is 4', parseInt, 4) // Default parallel uploads to 4
  .action(async (files: string[], runname: string, options: { parallel: number }) => {
    try {
      const validFileExtensions = ['.mcap', '.bag'];
      const invalidFiles = files.filter(file => !validFileExtensions.includes(path.extname(file)));
      if (invalidFiles.length > 0) {
        throw new Error(`Invalid file(s): ${invalidFiles.join(', ')}. Only .mcap and .bag files are allowed.`);
      }

      if (files.length === 0) {
        throw new Error('No files provided for upload.');
      }

      // List the files
      console.log('Files to upload:');
      files.forEach(file => console.log(`- ${file}`));

      // Fetch the run UUID by name
      const runResponse = await axios.get(`/run/byName?name=${encodeURIComponent(runname)}`);
      const runUuid = runResponse.data.uuid;

      // Post to /queue/createPresignedURLS with a list of filenames
      const createPresignedUrlsResponse = await axios.post('/queue/createPresignedURLS', { filenames: files });

      // Get the dictionary filename -> URL
      const filenameUrlMap = createPresignedUrlsResponse.data;

      // Upload files in parallel
      const promises = files.map(async (file) => {
        const fileUrl = filenameUrlMap[file];
        const fileStream = fs.createReadStream(file);
        await axios.put(fileUrl, fileStream);
        // Once each upload is complete, post /queue/confirmUpload with the filename
        await axios.post('/queue/confirmUpload', { filename: file });
        console.log(`File '${file}' uploaded successfully.`);
      });

      await Promise.all(promises);

      console.log('All files uploaded successfully.');
    } catch (error) {
      console.error('Error:', error.message);
    }
  })

program.parse(process.argv);  // Parse the command line arguments
