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

import { z } from 'zod';

import { defineTool } from './tool.js';
import * as javascript from '../javascript.js';

const extractFiltersSchema = z.object({
  limit: z.number().optional().describe('Maximum number of filters to return (default: 50)'),
  minScore: z.number().optional().describe('Minimum filter confidence score threshold (default: 2)'),
  includeHidden: z.boolean().optional().describe('Include collapsed/hidden filters (default: true)'),
  filterTypes: z.array(z.string()).optional().describe('Specific filter types to extract (checkbox, radio, select, range, search, toggle)'),
  selector: z.string().optional().describe('Optional custom container selector to use instead of auto-detection'),
});

const extractFilters = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_extract_filters',
    title: 'Extract filters from e-commerce page',
    description: 'Identify and extract filter/facet containers from e-commerce pages, enabling rapid adapter development for search refinement features',
    inputSchema: extractFiltersSchema,
    type: 'readOnly',
  },

  handle: async (context, params) => {
    const tab = context.currentTabOrDie();
    const limit = params.limit ?? 50;
    const minScore = params.minScore ?? 2;
    const includeHidden = params.includeHidden ?? true;
    const filterTypes = params.filterTypes;
    const customSelector = params.selector;

    const code = [
      `// Extract filters from e-commerce page`,
      `// Limit: ${limit}, Min Score: ${minScore}, Include Hidden: ${includeHidden}`,
      filterTypes ? `// Filter Types: ${filterTypes.join(', ')}` : '// All filter types',
      customSelector ? `// Using custom selector: ${customSelector}` : '// Using auto-detection',
    ];

    const extractionScript = `
      (function() {
        const startTime = performance.now();
        
        // Common filter container selectors
        const filterSelectors = [
          '[data-filter]', '[data-facet]', '[data-refinement]',
          '.filters', '.facets', '.refinements', '.sidebar-filters',
          '.filter-group', '.facet-group', '.search-filters',
          '.category-filters', '.product-filters', '.layered-nav',
          '[class*="filter"]', '[class*="facet"]', '[class*="refine"]',
          '.accordion', '.collapsible', '.expandable'
        ];
        
        // Score containers by filter-like characteristics
        function scoreFilterContainer(element) {
          let score = 0;
          
          // Check for input types
          if (element.querySelector('input[type="checkbox"]')) score += 3;
          if (element.querySelector('input[type="radio"]')) score += 2;
          if (element.querySelector('select')) score += 2;
          if (element.querySelector('input[type="range"]')) score += 2;
          
          // Check for filter-related text content
          const text = element.textContent.toLowerCase();
          if (text.match(/\\b(brand|size|color|price|category|rating|condition|type)\\b/)) score += 2;
          if (text.match(/\\b(filter|refine|narrow|search)\\b/)) score += 1;
          
          // Check for clear/reset buttons
          if (element.querySelector('button[class*="clear"], button[class*="reset"], a[class*="clear"]')) score += 1;
          
          // Check for labels
          if (element.querySelector('label')) score += 1;
          
          // Check for counts in parentheses (e.g., "Nike (25)")
          if (text.match(/\\(\\d+\\)/)) score += 1;
          
          return score;
        }
        
        // Classify filter type
        function classifyFilter(container) {
          if (container.querySelector('input[type="checkbox"]')) return 'checkbox';
          if (container.querySelector('input[type="radio"]')) return 'radio';
          if (container.querySelector('select')) return 'select';
          if (container.querySelector('input[type="range"], .slider, .range-slider')) return 'range';
          if (container.querySelector('input[type="text"], input[type="search"]')) return 'search';
          if (container.querySelector('button[role="switch"], .toggle, .switch')) return 'toggle';
          return 'unknown';
        }
        
        // Extract filter name
        function extractFilterName(container) {
          // Try various selectors for filter names
          const nameSelectors = [
            'legend', '.filter-title', '.facet-name', '.filter-name',
            '.accordion-title', '.collapsible-title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            '.title', '.heading', '.label-text', '[class*="title"]', '[class*="heading"]'
          ];
          
          for (const selector of nameSelectors) {
            const element = container.querySelector(selector);
            if (element && element.textContent.trim()) {
              return element.textContent.trim();
            }
          }
          
          // Fallback: use first text content that looks like a title
          const text = container.textContent.trim();
          const lines = text.split('\\n').map(line => line.trim()).filter(line => line);
          if (lines.length > 0) {
            return lines[0].length < 50 ? lines[0] : lines[0].substring(0, 50) + '...';
          }
          
          return 'Unknown Filter';
        }
        
        // Generate CSS selector for element
        function generateSelector(element) {
          if (element.id) return '#' + element.id;
          if (element.name) return \`[name="\${element.name}"]\`;
          if (element.className) {
            const classes = element.className.split(' ').filter(c => c.trim());
            if (classes.length > 0) return '.' + classes.join('.');
          }
          
          // Generate nth-child selector
          const parent = element.parentNode;
          if (parent) {
            const siblings = Array.from(parent.children);
            const index = siblings.indexOf(element) + 1;
            return element.tagName.toLowerCase() + ':nth-child(' + index + ')';
          }
          
          return element.tagName.toLowerCase();
        }
        
        // Extract options for different filter types
        function extractFilterOptions(container, filterType) {
          const options = [];
          
          switch (filterType) {
            case 'checkbox':
            case 'radio':
              const inputs = container.querySelectorAll(\`input[type="\${filterType}"]\`);
              inputs.forEach(input => {
                const label = input.closest('label') || 
                            container.querySelector(\`label[for="\${input.id}"]\`) ||
                            input.nextElementSibling ||
                            input.previousElementSibling;
                
                const labelText = label ? label.textContent.trim() : '';
                const countMatch = labelText.match(/\\((\\d+)\\)$/);
                const count = countMatch ? parseInt(countMatch[1]) : undefined;
                const cleanLabel = labelText.replace(/\\s*\\(\\d+\\)$/, '');
                
                options.push({
                  label: cleanLabel || input.value || 'Option',
                  value: input.value || input.id || '',
                  count: count,
                  selected: input.checked,
                  selector: generateSelector(input)
                });
              });
              break;
              
            case 'select':
              const selects = container.querySelectorAll('select');
              selects.forEach(select => {
                Array.from(select.options).forEach(option => {
                  if (option.value) {
                    options.push({
                      label: option.textContent.trim(),
                      value: option.value,
                      selected: option.selected,
                      selector: generateSelector(select) + \` option[value="\${option.value}"]\`
                    });
                  }
                });
              });
              break;
              
            case 'range':
              const rangeInputs = container.querySelectorAll('input[type="range"]');
              rangeInputs.forEach(input => {
                options.push({
                  label: input.getAttribute('aria-label') || 'Range',
                  value: input.value,
                  selected: false,
                  selector: generateSelector(input),
                  min: input.min,
                  max: input.max,
                  step: input.step
                });
              });
              break;
              
            case 'search':
              const searchInputs = container.querySelectorAll('input[type="text"], input[type="search"]');
              searchInputs.forEach(input => {
                options.push({
                  label: input.placeholder || input.getAttribute('aria-label') || 'Search',
                  value: input.value,
                  selected: !!input.value,
                  selector: generateSelector(input)
                });
              });
              break;
              
            case 'toggle':
              const toggles = container.querySelectorAll('button[role="switch"], .toggle, .switch');
              toggles.forEach(toggle => {
                const isPressed = toggle.getAttribute('aria-pressed') === 'true' || 
                                toggle.classList.contains('active') ||
                                toggle.classList.contains('on');
                
                options.push({
                  label: toggle.textContent.trim() || toggle.getAttribute('aria-label') || 'Toggle',
                  value: isPressed ? 'on' : 'off',
                  selected: isPressed,
                  selector: generateSelector(toggle)
                });
              });
              break;
          }
          
          return options;
        }
        
        // Check if filter is expanded/visible
        function isFilterExpanded(container) {
          const style = window.getComputedStyle(container);
          if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
          }
          
          // Check for collapsed accordion/collapsible
          const hasCollapsedClass = container.classList.contains('collapsed') || 
                                   container.classList.contains('closed') ||
                                   container.querySelector('.collapsed, .closed');
          
          const ariaExpanded = container.getAttribute('aria-expanded');
          if (ariaExpanded !== null) {
            return ariaExpanded === 'true';
          }
          
          return !hasCollapsedClass;
        }
        
        // Find clear/reset button for filter
        function findClearSelector(container) {
          const clearElements = container.querySelectorAll(
            'button[class*="clear"], button[class*="reset"], a[class*="clear"], a[class*="reset"]'
          );
          
          if (clearElements.length > 0) {
            return generateSelector(clearElements[0]);
          }
          
          return undefined;
        }
        
        let filterContainers;
        
        if (${customSelector ? `'${customSelector}'` : 'null'}) {
          // Use custom selector
          filterContainers = Array.from(document.querySelectorAll('${customSelector || ''}'));
        } else {
          // Auto-detect filter containers
          const allContainers = new Set();
          
          for (const selector of filterSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              elements.forEach(el => allContainers.add(el));
            } catch (e) {
              // Skip invalid selectors
            }
          }
          
          filterContainers = Array.from(allContainers);
        }
        
        // Score and filter containers
        const scoredContainers = filterContainers.map(container => ({
          element: container,
          score: scoreFilterContainer(container)
        })).filter(item => item.score >= ${minScore});
        
        // Sort by score descending
        scoredContainers.sort((a, b) => b.score - a.score);
        
        // Extract filter data
        const filters = [];
        const processedContainers = scoredContainers.slice(0, ${limit});
        
        for (const item of processedContainers) {
          const container = item.element;
          const filterType = classifyFilter(container);
          const isExpanded = isFilterExpanded(container);
          
          // Skip hidden filters if includeHidden is false
          if (!${includeHidden} && !isExpanded) {
            continue;
          }
          
          // Skip if filterTypes specified and this type not included
          if (${filterTypes ? JSON.stringify(filterTypes) : 'null'} && 
              !${filterTypes ? JSON.stringify(filterTypes) : '[]'}.includes(filterType)) {
            continue;
          }
          
          const filterName = extractFilterName(container);
          const options = extractFilterOptions(container, filterType);
          const clearSelector = findClearSelector(container);
          
          filters.push({
            name: filterName,
            type: filterType,
            containerSelector: generateSelector(container),
            options: options,
            score: item.score,
            isExpanded: isExpanded,
            clearSelector: clearSelector
          });
        }
        
        // Generate container summary
        const containerSummary = {};
        scoredContainers.forEach(item => {
          const filterType = classifyFilter(item.element);
          const key = filterType;
          
          if (!containerSummary[key]) {
            containerSummary[key] = { count: 0, totalScore: 0, totalOptions: 0 };
          }
          containerSummary[key].count++;
          containerSummary[key].totalScore += item.score;
          
          const options = extractFilterOptions(item.element, filterType);
          containerSummary[key].totalOptions += options.length;
        });
        
        const containerResults = Object.entries(containerSummary).map(([type, data]) => ({
          selector: type,
          type: type,
          score: Math.round(data.totalScore / data.count),
          optionCount: data.totalOptions
        })).sort((a, b) => b.optionCount - a.optionCount);
        
        const processingTime = Math.round(performance.now() - startTime);
        
        return {
          filters,
          containers: containerResults,
          totalFound: scoredContainers.length,
          processingTime
        };
      })();
    `;

    code.push(`const result = ${extractionScript}`);

    const action = async () => {
      const result = await tab.page.evaluate(extractionScript) as {
        filters: Array<{
          name: string;
          type: 'checkbox' | 'radio' | 'select' | 'range' | 'search' | 'toggle' | 'unknown';
          containerSelector: string;
          options: Array<{
            label: string;
            value: string;
            count?: number;
            selected: boolean;
            selector: string;
            min?: string;
            max?: string;
            step?: string;
          }>;
          score: number;
          isExpanded: boolean;
          clearSelector?: string;
        }>;
        containers: Array<{
          selector: string;
          type: string;
          score: number;
          optionCount: number;
        }>;
        totalFound: number;
        processingTime: number;
      };
      
      return {
        content: [{
          type: 'text' as 'text',
          text: JSON.stringify(result, null, 2),
        }]
      };
    };

    return {
      code,
      action,
      captureSnapshot: false,
      waitForNetwork: false,
    };
  },
});

export default [
  extractFilters,
];