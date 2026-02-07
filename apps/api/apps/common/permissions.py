from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    """Allow access only to users with role=admin."""

    def has_permission(self, request, view):
        return (
            request.user
            and request.user.is_authenticated
            and request.user.role == "admin"
        )


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: allows access if user is admin,
    or is the assigned_to / created_by of the object.
    """

    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.user.role == "admin":
            return True
        return (
            getattr(obj, "assigned_to_id", None) == request.user.id
            or getattr(obj, "created_by_id", None) == request.user.id
        )
