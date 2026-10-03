import React from 'react';
import CourseFilesManager, { CourseFileItem, COURSE_IB_THEMES, DEFAULT_IB_THEMES } from './CourseFilesManager';
import { Socket } from 'socket.io-client';

export interface CourseFoldersProps {
  courseId: string;
  courseTitle: string;
  socket?: Socket | null;
  currentUserId: number;
  currentUsername: string;
}

export { CourseFilesManager, COURSE_IB_THEMES, DEFAULT_IB_THEMES };
export type { CourseFileItem };

export default function CourseFolders(props: CourseFoldersProps) {
  return <CourseFilesManager {...props} />;
}
