/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import accessibility from './tools/accessibility.js';
import advancedWaiting from './tools/advancedWaiting.js';
import common from './tools/common.js';
import console from './tools/console.js';
import dialogs from './tools/dialogs.js';
import domManipulation from './tools/domManipulation.js';
import files from './tools/files.js';
import filterExtraction from './tools/filterExtraction.js';
import frameManagement from './tools/frameManagement.js';
import htmlExtraction from './tools/htmlExtraction.js';
import install from './tools/install.js';
import javascript from './tools/javascript.js';
import keyboard from './tools/keyboard.js';
import navigate from './tools/navigate.js';
import network from './tools/network.js';
import networkInterception from './tools/networkInterception.js';
import pageInformation from './tools/pageInformation.js';
import pdf from './tools/pdf.js';
import productExtraction from './tools/productExtraction.js';
import scriptInjection from './tools/scriptInjection.js';
import storage from './tools/storage.js';
import snapshot from './tools/snapshot.js';
import tabs from './tools/tabs.js';
import screenshot from './tools/screenshot.js';
import testing from './tools/testing.js';
import vision from './tools/vision.js';
import wait from './tools/wait.js';

import type { Tool } from './tools/tool.js';

export const snapshotTools: Tool<any>[] = [
  ...accessibility(true),
  ...advancedWaiting(false), // Disable auto-snapshot for waiting
  ...common(true),
  ...console,
  ...dialogs(true),
  ...domManipulation(true),
  ...files(true),
  ...filterExtraction,
  ...frameManagement(true),
  ...htmlExtraction,
  ...install,
  ...javascript(true),
  ...keyboard(true),
  ...navigate(false), // Disable auto-snapshot for navigation
  ...network,
  ...networkInterception(false), // Disable auto-snapshot for network interception
  ...pageInformation(true),
  ...pdf,
  ...productExtraction,
  ...scriptInjection(true),
  ...screenshot,
  ...snapshot,
  ...storage(true),
  ...tabs(false), // Disable auto-snapshot for tab operations
  ...testing,
  ...wait(false), // Disable auto-snapshot for waiting
];

export const visionTools: Tool<any>[] = [
  ...accessibility(false),
  ...advancedWaiting(false),
  ...common(false),
  ...console,
  ...dialogs(false),
  ...domManipulation(false),
  ...files(false),
  ...filterExtraction,
  ...frameManagement(false),
  ...htmlExtraction,
  ...install,
  ...javascript(false),
  ...keyboard(false),
  ...navigate(false),
  ...network,
  ...networkInterception(false),
  ...pageInformation(false),
  ...pdf,
  ...productExtraction,
  ...scriptInjection(false),
  ...storage(false),
  ...tabs(false),
  ...testing,
  ...vision,
  ...wait(false),
];
