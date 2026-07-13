import type {
  CommunityPost,
  CommunityPostCategory,
  CommunityPostReport,
  CommunityPostReportCreateInput
} from "@streamops/shared";
import { apiBase } from "../../../api/client";

export type CommunityPostSubmitInput = {
  category: CommunityPostCategory;
  title: string;
  body: string;
  riotId: string;
  tags: string;
  imageFile?: File | null;
  partyTier?: string;
  partyRole?: string;
  partyMode?: string;
  partyVoice?: string;
  partyCapacity?: number;
};

async function communityErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown; message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.error === "string" && body.error.trim()) return body.error;
  } catch {
    // JSON 오류 응답이 아니면 상태 코드 기반 문구를 사용합니다.
  }
  return `community request failed: ${response.status}`;
}

function communityFormData(input: CommunityPostSubmitInput): FormData {
  const formData = new FormData();
  formData.set("category", input.category);
  formData.set("title", input.title);
  formData.set("body", input.body);
  if (input.riotId.trim()) formData.set("riotId", input.riotId.trim());
  if (input.tags.trim()) formData.set("tags", input.tags.trim());
  if (input.partyTier?.trim()) formData.set("partyTier", input.partyTier.trim());
  if (input.partyRole?.trim()) formData.set("partyRole", input.partyRole.trim());
  if (input.partyMode?.trim()) formData.set("partyMode", input.partyMode.trim());
  if (input.partyVoice?.trim()) formData.set("partyVoice", input.partyVoice.trim());
  if (input.partyCapacity) formData.set("partyCapacity", String(input.partyCapacity));
  if (input.imageFile) formData.set("image", input.imageFile);
  return formData;
}

export async function getPublicCommunityPosts(category?: CommunityPostCategory): Promise<CommunityPost[]> {
  const params = new URLSearchParams({ limit: "50" });
  if (category) params.set("category", category);
  const response = await fetch(`${apiBase}/api/public/community/posts?${params.toString()}`, {
    credentials: "include"
  });
  if (!response.ok) throw new Error(await communityErrorMessage(response));
  const body = await response.json() as { posts?: CommunityPost[] };
  return Array.isArray(body.posts) ? body.posts : [];
}

export async function createPublicCommunityPost(input: CommunityPostSubmitInput): Promise<CommunityPost[]> {
  const response = await fetch(`${apiBase}/api/public/community/posts`, {
    method: "POST",
    credentials: "include",
    body: communityFormData(input)
  });
  if (!response.ok) throw new Error(await communityErrorMessage(response));
  const body = await response.json() as { post?: CommunityPost; posts?: CommunityPost[] };
  if (Array.isArray(body.posts)) return body.posts;
  const refreshedPosts = await getPublicCommunityPosts(input.category);
  if (refreshedPosts.length > 0) return refreshedPosts;
  return body.post ? [body.post] : [];
}

export async function updatePublicCommunityPost(postId: string, input: CommunityPostSubmitInput): Promise<CommunityPost[]> {
  const response = await fetch(`${apiBase}/api/public/community/posts/${encodeURIComponent(postId)}`, {
    method: "PATCH",
    credentials: "include",
    body: communityFormData(input)
  });
  if (!response.ok) throw new Error(await communityErrorMessage(response));
  const body = await response.json() as { post?: CommunityPost; posts?: CommunityPost[] };
  if (Array.isArray(body.posts)) return body.posts;
  const refreshedPosts = await getPublicCommunityPosts(input.category);
  if (refreshedPosts.length > 0) return refreshedPosts;
  return body.post ? [body.post] : [];
}

export async function createPublicCommunityComment(postId: string, body: string): Promise<CommunityPost[]> {
  const response = await fetch(`${apiBase}/api/public/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body })
  });
  if (!response.ok) throw new Error(await communityErrorMessage(response));
  const responseBody = await response.json() as { post?: CommunityPost; posts?: CommunityPost[] };
  if (Array.isArray(responseBody.posts)) return responseBody.posts;
  const refreshedPosts = await getPublicCommunityPosts("party");
  if (refreshedPosts.length > 0) return refreshedPosts;
  return responseBody.post ? [responseBody.post] : [];
}

export async function createPublicCommunityReport(
  postId: string,
  input: CommunityPostReportCreateInput
): Promise<CommunityPostReport> {
  const response = await fetch(`${apiBase}/api/public/community/posts/${encodeURIComponent(postId)}/reports`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  if (!response.ok) throw new Error(await communityErrorMessage(response));
  const body = await response.json() as { report?: CommunityPostReport };
  if (!body.report) throw new Error("community report response is invalid");
  return body.report;
}
