export class SubmitAnalysisRun {
  runUUID: string;
  docker_image: string;
}

export class AnalysisRunQuery {
  projectUUID: string;
  run_uuids: string;
}

export class AnalysisRunDetailsQuery {
  analysis_uuid: string;
}