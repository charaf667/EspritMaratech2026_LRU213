from rest_framework import serializers

from .models import User


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, max_length=128)

    def validate_email(self, value):
        return value.strip().lower()


class UserSerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    email = serializers.EmailField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)
    is_active = serializers.BooleanField(read_only=True)


class CreateUserSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    first_name = serializers.CharField(max_length=150, min_length=1)
    last_name = serializers.CharField(max_length=150, min_length=1)
    role = serializers.ChoiceField(choices=User.Role.choices)

    def validate_email(self, value):
        value = value.strip().lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("Un utilisateur avec cet email existe déjà.")
        return value

    def validate_first_name(self, value):
        return value.strip()

    def validate_last_name(self, value):
        return value.strip()

    def validate_password(self, value):
        if value.isdigit():
            raise serializers.ValidationError("Le mot de passe ne peut pas être entièrement numérique.")
        return value


class UpdateUserSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, min_length=1, required=False)
    last_name = serializers.CharField(max_length=150, min_length=1, required=False)
    role = serializers.ChoiceField(choices=User.Role.choices, required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_first_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le prénom ne peut pas être vide.")
        return value

    def validate_last_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Le nom ne peut pas être vide.")
        return value
