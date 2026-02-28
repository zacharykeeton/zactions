"use client";

import { Settings2 } from "lucide-react";
import { useCompactMode } from "@/hooks/use-compact-mode";
import { cn } from "@/lib/utils";
import type { CompactModeSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SettingRowProps {
  id: string;
  label: string;
  settingKey: keyof CompactModeSettings;
  settings: CompactModeSettings;
  onToggle: (key: keyof CompactModeSettings) => void;
}

function SettingRow({ id, label, settingKey, settings, onToggle }: SettingRowProps) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={settings[settingKey]}
        onCheckedChange={() => onToggle(settingKey)}
      />
      <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

export function CompactModeSettings() {
  const { compactMode, settings, updateSettings } = useCompactMode();

  function handleToggle(key: keyof CompactModeSettings) {
    updateSettings({ [key]: !settings[key] });
  }

  return (
    <Popover>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(!compactMode && "opacity-50")}
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>Compact mode settings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent className="w-56" align="end">
        <p className="mb-3 text-sm font-medium">Show in compact mode</p>

        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Badges</p>
        <div className="space-y-2">
          <SettingRow id="cms-priority" label="Priority" settingKey="showPriority" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-tags" label="Tags" settingKey="showTags" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-recurrence" label="Recurrence" settingKey="showRecurrence" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-completion-count" label="Completion count" settingKey="showCompletionCount" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-status" label="Status (blocked)" settingKey="showStatus" settings={settings} onToggle={handleToggle} />
        </div>

        <Separator className="my-3" />

        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Dates</p>
        <div className="space-y-2">
          <SettingRow id="cms-created-date" label="Created date" settingKey="showCreatedDate" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-start-date" label="Start date" settingKey="showStartDate" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-scheduled-date" label="Scheduled date" settingKey="showScheduledDate" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-due-date" label="Due date" settingKey="showDueDate" settings={settings} onToggle={handleToggle} />
          <SettingRow id="cms-completed-date" label="Completed date" settingKey="showCompletedDate" settings={settings} onToggle={handleToggle} />
        </div>

        <Separator className="my-3" />

        <div className="space-y-2">
          <SettingRow id="cms-time-estimate" label="Time estimate" settingKey="showTimeEstimate" settings={settings} onToggle={handleToggle} />
        </div>
      </PopoverContent>
    </Popover>
  );
}
