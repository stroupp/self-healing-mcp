import { promises as fs } from 'fs';
import path from 'path';
import {
  AtrKnowledge,
  ComponentRule,
  KnowledgeLoadOptions,
  KnowledgeSummary,
  LocatorTemplate
} from './knowledgeTypes';

const baseLocator = (suffix: string, selector: string, collection = false): LocatorTemplate => ({
  suffix,
  selector,
  collection
});

const defaultComponentRules: ComponentRule[] = [
  {
    componentNames: ['Button', 'IonButton', 'IonFabButton', 'IonItemOption', 'IonBackButton', 'IonChip'],
    typeKey: 'btn',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Icon', "[data-test-id='{id}'] .ykb-ui-button-icon"),
      baseLocator('Text', "[data-test-id='{id}'] .ykb-ui-button-text")
    ]
  },
  {
    componentNames: ['TextInput', 'CurrencyInput', 'EmailInput', 'PhoneInput', 'NumberInput', 'IbanInput', 'AutoComplete', 'IonInput', 'IonSearchbar'],
    typeKey: 'input',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input")
    ]
  },
  {
    componentNames: ['Select', 'TreeSelect', 'IonSelect'],
    typeKey: 'select',
    locatorTemplates: [
      baseLocator('Wrapper', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input"),
      baseLocator('Arrow', "[data-test-id='{id}'] .ykb-ui-select-arrow"),
      baseLocator('Clear', "[data-test-id='{id}'] .ykb-ui-select-clear")
    ]
  },
  {
    componentNames: ['Textarea', 'IonTextarea'],
    typeKey: 'textarea',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Textarea', "[data-test-id='{id}'] textarea"),
      baseLocator('Counter', "[data-test-id='{id}'] .ykb-ui-textarea-counter")
    ]
  },
  {
    componentNames: ['Modal', 'IonModal', 'IonPopover', 'IonActionSheet'],
    typeKey: 'modal',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Header', "[data-test-id='{id}'] .ykb-ui-modal-header"),
      baseLocator('Title', "[data-test-id='{id}'] .ykb-ui-modal-title"),
      baseLocator('Content', "[data-test-id='{id}'] .ykb-ui-modal-body"),
      baseLocator('Footer', "[data-test-id='{id}'] .ykb-ui-modal-footer"),
      baseLocator('CloseButton', "[data-test-id='{id}'] .ykb-ui-modal-close")
    ]
  },
  {
    componentNames: ['Table', 'EditableTable'],
    typeKey: 'table',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Headers', "[data-test-id='{id}'] thead th", true),
      baseLocator('Rows', "[data-test-id='{id}'] tbody tr", true),
      baseLocator('Cells', "[data-test-id='{id}'] tbody td", true),
      baseLocator('FirstRow', "[data-test-id='{id}'] tbody tr:first-child")
    ]
  },
  {
    componentNames: ['IonList'],
    typeKey: 'table',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Rows', "[data-test-id='{id}'] ion-item", true)
    ]
  },
  {
    componentNames: ['Checkbox', 'CheckboxGroup', 'IonCheckbox'],
    typeKey: 'checkbox',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input[type='checkbox']"),
      baseLocator('Items', "[data-test-id='{id}'] .ykb-ui-checkbox", true)
    ]
  },
  {
    componentNames: ['Radio', 'RadioGroup', 'RadioSelectionBox', 'IonRadio', 'IonRadioGroup', 'IonSegmentButton'],
    typeKey: 'radio',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input[type='radio']"),
      baseLocator('Items', "[data-test-id='{id}'] .ykb-ui-radio", true)
    ]
  },
  {
    componentNames: ['DatePicker', 'IonDatetime'],
    typeKey: 'datepicker',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input")
    ]
  },
  {
    componentNames: ['TimePicker'],
    typeKey: 'timepicker',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input")
    ]
  },
  {
    componentNames: ['Switch', 'IonToggle'],
    typeKey: 'switch',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input[type='checkbox']")
    ]
  },
  {
    componentNames: ['Tabs', 'IonSegment'],
    typeKey: 'tabs',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('TabItems', "[data-test-id='{id}'] .ykb-ui-tabs-tab", true)
    ]
  },
  {
    componentNames: ['Form'],
    typeKey: 'form',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']")
    ]
  },
  {
    componentNames: ['Menu', 'IonMenu'],
    typeKey: 'menu',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Items', "[data-test-id='{id}'] .ykb-ui-menu-item", true)
    ]
  },
  {
    componentNames: ['Pagination'],
    typeKey: 'pagination',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('PrevBtn', "[data-test-id='{id}'] .ykb-ui-pagination-prev"),
      baseLocator('NextBtn', "[data-test-id='{id}'] .ykb-ui-pagination-next")
    ]
  },
  {
    componentNames: ['Dropdown', 'IonSelectOption'],
    typeKey: 'dropdown',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Trigger', "[data-test-id='{id}'] .ykb-ui-dropdown-trigger")
    ]
  },
  {
    componentNames: ['Upload'],
    typeKey: 'upload',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Input', "[data-test-id='{id}'] input[type='file']")
    ]
  },
  {
    componentNames: ['Steps'],
    typeKey: 'steps',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Items', "[data-test-id='{id}'] .ykb-ui-step-item", true)
    ]
  },
  {
    componentNames: ['YkbMaps', 'Map'],
    typeKey: 'map',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']"),
      baseLocator('Canvas', "[data-test-id='{id}'] canvas"),
      baseLocator('Controls', "[data-test-id='{id}'] .gm-control-active", true)
    ]
  },
  {
    componentNames: ['Alert', 'Notification', 'IonAlert', 'IonToast', 'IonLoading'],
    typeKey: 'alert',
    locatorTemplates: [
      baseLocator('Element', "[data-test-id='{id}']")
    ]
  }
];

export async function loadAtrKnowledge(options: KnowledgeLoadOptions): Promise<AtrKnowledge> {
  const sourcePath = await resolveKnowledgePath(options);
  const markdown = sourcePath ? await fs.readFile(sourcePath, 'utf8') : '';
  const sourceStats = sourcePath ? await fs.stat(sourcePath) : undefined;

  return {
    sourcePath,
    sourceBytes: sourceStats?.size,
    sectionTitles: extractSectionTitles(markdown),
    namingPattern: '{project}-{page}-{element-type}-{element-name}',
    elementNamePriority: [
      'label prop',
      'placeholder prop',
      'title prop',
      'name or id prop',
      'readable component text',
      'action name from handler',
      'sequential fallback'
    ],
    componentRules: defaultComponentRules,
    generatedFiles: [
      '{PageName}Page.java',
      '{PageName}Steps.java',
      '{page-name}.feature'
    ],
    protectedFiles: [
      'LoginPage.java',
      'HomePage.java',
      'LoginSteps.java',
      'HomePageSteps.java',
      'Hooks.java',
      'Util.java',
      'RequestObject.java',
      'SqlExecutorForAutomation.java'
    ],
    sharedStepOwners: [
      'LoginSteps.java',
      'HomePageSteps.java',
      'Hooks.java'
    ],
    defaultFeatureBackgroundRules: [
      'Use existing shared login and navigation steps.',
      'Do not duplicate login, menu navigation, or browser lifecycle steps in page-specific step classes.',
      'Keep scenario steps page-specific and mapped to the generated step class.'
    ],
    pageObjectRules: [
      'Use one project-specific SHADOW_ROOT constant per page object.',
      'Use data-test-id selectors before structural CSS selectors.',
      'Prefer public fields only when the target project expects direct step access.',
      'Do not inline the shadow root string in every locator.'
    ],
    safetyRules: [
      'Never store secrets, credentials, or real customer data in generated files.',
      'Do not modify shared infrastructure files unless explicitly requested.',
      'Do not modify production UI behavior while adding test identifiers.',
      'Apply automatic locator healing only under src/test/**.'
    ]
  };
}

export function summarizeKnowledge(knowledge: AtrKnowledge): KnowledgeSummary {
  return {
    sourcePath: knowledge.sourcePath,
    sourceBytes: knowledge.sourceBytes,
    sections: knowledge.sectionTitles.slice(0, 30),
    namingPattern: knowledge.namingPattern,
    supportedTypeKeys: Array.from(new Set(knowledge.componentRules.map(rule => rule.typeKey))).sort(),
    generatedFiles: knowledge.generatedFiles,
    protectedFiles: knowledge.protectedFiles,
    safetyRules: knowledge.safetyRules
  };
}

async function resolveKnowledgePath(options: KnowledgeLoadOptions): Promise<string | undefined> {
  const candidates = [
    options.knowledgeFile,
    path.join(options.workspaceRoot, 'docs', 'knowledge.md')
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const absolute = path.isAbsolute(candidate)
      ? candidate
      : path.resolve(options.workspaceRoot, candidate);
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) {
        return absolute;
      }
    } catch {
      // Try the next candidate.
    }
  }

  return undefined;
}

function extractSectionTitles(markdown: string): string[] {
  const titles: string[] = [];
  const headingRegex = /^#{1,3}\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(markdown)) !== null) {
    titles.push(sanitizeKnowledgeText(match[1].trim()));
  }

  return titles;
}

function sanitizeKnowledgeText(value: string): string {
  return value
    .replace(/\bSparx\b/gi, 'application shell')
    .replace(/\bYKB-UI\b/gi, 'component library')
    .replace(/\bYKB\b/gi, 'component library')
    .replace(/\s+/g, ' ')
    .trim();
}
