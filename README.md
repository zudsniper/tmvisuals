# TaskMaster Visualizer

Interactive mind map visualization for Claude Task Master tasks with hierarchical dependencies, status tracking, and editor integration.

## Features

- **Mind Map Visualization**: ReactFlow-based interactive task graph
- **Hierarchical Task Display**: Parent tasks with subtask progress tracking
- **Dependency Visualization**: Animated edges showing task dependencies
- **Status Management**: Update task status (pending/in-progress/done)
- **Priority Indicators**: Visual borders for high/medium/low priority
- **Editor Integration**: Open tasks in VSCode or Cursor
- **Collapsible Nodes**: Toggle task details visibility
- **Task Details Panel**: Full task information sidebar
- **Settings Panel**: Configure default editor preference

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Visualization**: ReactFlow 11
- **State Management**: Zustand 4
- **Styling**: Tailwind CSS 3
- **Build**: Vite 5
- **Icons**: Lucide React

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

Open http://localhost:5173

## Project Structure

```
tmvisuals/
├── src/
│   ├── components/
│   │   ├── TaskNode.tsx       # Custom ReactFlow node component
│   │   ├── TaskDetails.tsx    # Task information sidebar
│   │   └── Settings.tsx       # Editor preference settings
│   ├── store/
│   │   └── taskStore.ts       # Zustand store for task management
│   ├── types/
│   │   └── task.ts           # TypeScript interfaces
│   ├── utils/
│   ├── App.tsx               # Main application component
│   └── main.tsx              # Entry point
├── tasks/                    # Task data files
│   ├── tasks.json           # Main task database
│   └── task_*.txt           # Individual task files
└── public/

```

## Task Data Format

Tasks follow the Claude Task Master format:

```typescript
interface Task {
  id: number;
  title: string;
  description: string;
  details: string;
  testStrategy: string;
  priority: 'low' | 'medium' | 'high';
  dependencies: number[];
  status: 'pending' | 'in-progress' | 'done';
  subtasks: Subtask[];
}
```

## Usage

1. **Navigate**: Pan/zoom with mouse, use minimap/controls
2. **Select Task**: Click node to view details
3. **Update Status**: Change status in details panel
4. **Collapse/Expand**: Toggle node content visibility
5. **Open in Editor**: Click external link icon
6. **Configure Editor**: Access settings via gear icon

## Editor Integration

Supports opening task files in:
- Cursor (default)
- Visual Studio Code

Configure preference in Settings panel.

## Build

```bash
npm run build
```

Production files in `dist/` directory.

## Future Enhancements

- [ ] Task editing capability
- [ ] Supabase integration for persistence
- [ ] Real-time collaboration
- [ ] Advanced filtering/search
- [ ] Export visualization
- [ ] Custom layouts
- [ ] Task creation UI
- [ ] Electron desktop app for native editor integration