export interface ComponentRule {
  componentNames: string[];
  typeKey: string;
  locatorTemplates: LocatorTemplate[];
}

export interface LocatorTemplate {
  suffix: string;
  selector: string;
  collection: boolean;
}

export interface AtrKnowledge {
  sourcePath?: string;
  sourceBytes?: number;
  sectionTitles: string[];
  namingPattern: string;
  elementNamePriority: string[];
  componentRules: ComponentRule[];
  generatedFiles: string[];
  protectedFiles: string[];
  sharedStepOwners: string[];
  defaultFeatureBackgroundRules: string[];
  pageObjectRules: string[];
  safetyRules: string[];
}

export interface KnowledgeLoadOptions {
  workspaceRoot: string;
  knowledgeFile?: string;
}

export interface KnowledgeSummary {
  sourcePath?: string;
  sourceBytes?: number;
  sections: string[];
  namingPattern: string;
  supportedTypeKeys: string[];
  generatedFiles: string[];
  protectedFiles: string[];
  safetyRules: string[];
}
