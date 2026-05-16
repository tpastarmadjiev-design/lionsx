import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface SuspicionRecord {
  id: string;
  user_id: string;
  exercise_name: string | null;
  unrealistic_speed: boolean;
  single_axis_motion: boolean;
  micro_movements: boolean;
  volume_spike: boolean;
  no_orientation_change: boolean;
  suspicion_score: number;
  average_tempo: number | null;
  axis_distribution: { x: number; y: number; z: number } | null;
  orientation_change: number | null;
  total_reps: number;
  created_at: string;
  nickname?: string;
}

interface UserSuspicionSummary {
  user_id: string;
  nickname: string;
  maxScore: number;
  flagCount: number;
  records: SuspicionRecord[];
}

function getScoreColor(score: number): string {
  if (score >= 60) return 'text-destructive';
  if (score >= 40) return 'text-orange-500';
  if (score >= 20) return 'text-yellow-500';
  return 'text-green-500';
}

function getScoreLabel(score: number): string {
  if (score >= 60) return 'Confirmed Cheating';
  if (score >= 40) return 'Likely Cheating';
  if (score >= 20) return 'Monitor';
  return 'Clean';
}

function getScoreBadgeVariant(score: number): 'destructive' | 'outline' | 'secondary' | 'default' {
  if (score >= 60) return 'destructive';
  if (score >= 40) return 'outline';
  if (score >= 20) return 'secondary';
  return 'default';
}

export function AdminSuspiciousActivity() {
  const [summaries, setSummaries] = useState<UserSuspicionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserSuspicionSummary | null>(null);

  useEffect(() => {
    fetchSuspicionData();
  }, []);

  const fetchSuspicionData = async () => {
    setLoading(true);

    const { data: flags, error } = await supabase
      .from('suspicion_flags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch suspicion flags:', error);
      setLoading(false);
      return;
    }

    // Get nicknames
    const userIds = [...new Set((flags || []).map(f => f.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, nickname')
      .in('id', userIds);

    const nicknameMap = new Map(profiles?.map(p => [p.id, p.nickname]) || []);

    // Group by user
    const userMap = new Map<string, UserSuspicionSummary>();
    (flags || []).forEach(f => {
      const record: SuspicionRecord = {
        ...f,
        axis_distribution: f.axis_distribution as { x: number; y: number; z: number } | null,
        nickname: nicknameMap.get(f.user_id) || 'Unknown',
      };

      if (!userMap.has(f.user_id)) {
        userMap.set(f.user_id, {
          user_id: f.user_id,
          nickname: nicknameMap.get(f.user_id) || 'Unknown',
          maxScore: f.suspicion_score,
          flagCount: 0,
          records: [],
        });
      }

      const summary = userMap.get(f.user_id)!;
      summary.records.push(record);
      summary.maxScore = Math.max(summary.maxScore, f.suspicion_score);

      // Count total flags
      const flagsTriggered = [
        f.unrealistic_speed,
        f.single_axis_motion,
        f.micro_movements,
        f.volume_spike,
        f.no_orientation_change,
      ].filter(Boolean).length;
      summary.flagCount += flagsTriggered;
    });

    const sorted = [...userMap.values()].sort((a, b) => b.maxScore - a.maxScore);
    setSummaries(sorted);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading suspicious activity...</div>;
  }

  const highRiskUsers = summaries.filter(s => s.maxScore >= 60);

  return (
    <div className="space-y-6">
      {/* High Risk Banner */}
      {highRiskUsers.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-destructive flex-shrink-0" />
          <div>
            <p className="font-semibold text-destructive">⚠️ High Cheating Probability — review user logs</p>
            <p className="text-sm text-muted-foreground mt-1">
              {highRiskUsers.length} user{highRiskUsers.length > 1 ? 's' : ''} with suspicion score ≥ 60
            </p>
          </div>
        </div>
      )}

      {/* Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldAlert className="w-5 h-5" />
            Suspicious Activity Flags
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-green-500" />
              <p>No suspicious activity detected</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-center">Score</TableHead>
                  <TableHead className="text-center">Flags</TableHead>
                  <TableHead className="text-center">Sessions</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map(s => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-medium">{s.nickname}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={getScoreBadgeVariant(s.maxScore)}>
                        <span className={getScoreColor(s.maxScore)}>
                          {s.maxScore} — {getScoreLabel(s.maxScore)}
                        </span>
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{s.flagCount}</TableCell>
                    <TableCell className="text-center">{s.records.length}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedUser(s)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              {selectedUser?.nickname} — Behavior Logs
            </DialogTitle>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-4">
              {/* Overall Score */}
              <div className="p-3 rounded-lg bg-secondary/50 text-center">
                <p className="text-sm text-muted-foreground">Max Suspicion Score</p>
                <p className={`text-3xl font-display font-bold ${getScoreColor(selectedUser.maxScore)}`}>
                  {selectedUser.maxScore}
                </p>
                <p className={`text-sm font-medium ${getScoreColor(selectedUser.maxScore)}`}>
                  {getScoreLabel(selectedUser.maxScore)}
                </p>
              </div>

              {/* Session-by-session logs */}
              {selectedUser.records.map((r, i) => (
                <Card key={r.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>{r.exercise_name || 'Unknown Exercise'}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Reps</span>
                      <span>{r.total_reps}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Avg Tempo</span>
                      <span>{r.average_tempo ? `${r.average_tempo}ms` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Axis (X/Y/Z)</span>
                      <span>
                        {r.axis_distribution
                          ? `${r.axis_distribution.x}% / ${r.axis_distribution.y}% / ${r.axis_distribution.z}%`
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Orientation Change</span>
                      <span>{r.orientation_change != null ? `${r.orientation_change}°` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Score</span>
                      <span className={`font-bold ${getScoreColor(r.suspicion_score)}`}>{r.suspicion_score}</span>
                    </div>
                    {/* Flags */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {r.unrealistic_speed && <Badge variant="destructive" className="text-xs">Speed</Badge>}
                      {r.single_axis_motion && <Badge variant="destructive" className="text-xs">Single Axis</Badge>}
                      {r.micro_movements && <Badge variant="destructive" className="text-xs">Micro Mvmt</Badge>}
                      {r.volume_spike && <Badge variant="destructive" className="text-xs">Volume Spike</Badge>}
                      {r.no_orientation_change && <Badge variant="destructive" className="text-xs">No Orientation</Badge>}
                      {!r.unrealistic_speed && !r.single_axis_motion && !r.micro_movements && !r.volume_spike && !r.no_orientation_change && (
                        <Badge variant="default" className="text-xs">Clean</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
