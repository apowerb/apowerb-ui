import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/app/globals.css';
// Import all your components from components
// Note: Make sure these components have 'use client' directive at the top
import AgentCanvas from '../src/components/AgentCanvas';
import AgentCard from '../src/components/AgentCard';
import AgentCompositeCard from '../src/components/AgentCompositeCard';
import AgentDetailsModal from '../src/components/AgentDetailsModal';
import AgentDiagram from '../src/components/AgentDiagram';
import AgentHeader from '../src/components/AgentHeader';
import AgentModal from '../src/components/AgentModal';
import AgentSidebar from '../src/components/AgentSidebar';
import ConfirmToast from '../src/components/ConfirmToast';
import DiagramEditor from '../src/components/DiagramEditor';
import DiagramTab from '../src/components/DiagramTab';
import WorkflowPanel from '../src/components/WorkflowPanel';

// Export all components for ES module usage
export {
  AgentCanvas,
  AgentCard,
  AgentCompositeCard,
  AgentDetailsModal,
  AgentDiagram,
  AgentHeader,
  AgentModal,
  AgentSidebar,
  ConfirmToast,
  DiagramEditor,
  DiagramTab,
  WorkflowPanel
};

// Create global object with all components
window.TH2Components = {
  AgentCanvas,
  AgentCard,
  AgentCompositeCard,
  AgentDetailsModal,
  AgentDiagram,
  AgentHeader,
  AgentModal,
  AgentSidebar,
  ConfirmToast,
  DiagramEditor,
  DiagramTab,
  WorkflowPanel,
  
  // Initialization function for manual mounting
  init: function(elementId, componentName, props = {}) {
    const element = document.getElementById(elementId);
    if (!element) {
      console.error(`[TH2Components] Element with id "${elementId}" not found`);
      return;
    }
    
    const Component = this[componentName];
    if (!Component) {
      console.error(`[TH2Components] Component "${componentName}" not found`);
      console.log('[TH2Components] Available components:', Object.keys(this).filter(k => k !== 'init'));
      return;
    }
    
    try {
      const root = ReactDOM.createRoot(element);
      root.render(React.createElement(Component, props));
      console.log(`[TH2Components] Successfully mounted ${componentName}`);
    } catch (error) {
      console.error(`[TH2Components] Error mounting ${componentName}:`, error);
    }
  },
  
  // Helper to list all available components
  listComponents: function() {
    return Object.keys(this).filter(k => k !== 'init' && k !== 'listComponents');
  }
};

// Auto-initialize components with data attributes
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('[data-th2-component]');
    
    if (elements.length > 0) {
      console.log(`[TH2Components] Found ${elements.length} component(s) to initialize`);
    }
    
    elements.forEach((element, index) => {
      const componentName = element.getAttribute('data-th2-component');
      const propsString = element.getAttribute('data-props');
      
      try {
        const props = propsString ? JSON.parse(propsString) : {};
        const Component = window.TH2Components[componentName];
        
        if (Component) {
          const root = ReactDOM.createRoot(element);
          root.render(React.createElement(Component, props));
          console.log(`[TH2Components] Auto-initialized ${componentName} (${index + 1}/${elements.length})`);
        } else {
          console.error(`[TH2Components] Component "${componentName}" not found`);
        }
      } catch (error) {
        console.error(`[TH2Components] Error initializing component ${index + 1}:`, error);
      }
    });
  });
  
  // Log when library is loaded
  console.log('[TH2Components] Library loaded. Available components:', 
    Object.keys(window.TH2Components).filter(k => k !== 'init' && k !== 'listComponents')
  );
}
