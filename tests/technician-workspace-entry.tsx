import React from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from '../src/components/workspace';
// Mount the production workspace. No injected dialog, editContext, or window.fetch overrides.
createRoot(document.getElementById('root')!).render(<Workspace/>);
