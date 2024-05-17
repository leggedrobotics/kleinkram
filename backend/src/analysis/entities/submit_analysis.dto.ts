export class SubmitAnalysisRun {
  runUUID: string;
  docker_image: string;
}

export class AnalysisRunQuery {
  projectUUID: string;
  run_uuids: string;
}
