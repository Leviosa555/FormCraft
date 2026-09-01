from django.contrib.auth.models import User, update_last_login
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
import re


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "last_login",
            "date_joined",
        ]
        read_only_fields = ["id", "last_login", "date_joined"]


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        login_input = attrs.get("username", "").strip()
        password = attrs.get("password", "")

        # Strict: Username only (do not allow email login)
        if "@" in login_input:
            raise serializers.ValidationError("Email or Password is incorrect.")

        user = User.objects.filter(username__iexact=login_input).first()

        if user and user.check_password(password):
            if not user.is_active:
                raise serializers.ValidationError("Email or Password is incorrect.")
            attrs["username"] = user.username
            data = super().validate(attrs)
            update_last_login(None, user)
            user.refresh_from_db()
            data["user"] = UserSerializer(user).data
            return data

        raise serializers.ValidationError("Email or Password is incorrect.")




class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    email = serializers.EmailField(required=True)
    first_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    last_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    username = serializers.CharField(
        required=True,
        validators=[
            UniqueValidator(
                queryset=User.objects.all(),
                message="This username is already taken.",
                lookup="iexact",
            )
        ],
    )

    class Meta:
        model = User
        fields = ["id", "username", "email", "password", "first_name", "last_name"]

    def validate_first_name(self, value):
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("First name is required.")
        return trimmed

    def validate_last_name(self, value):
        trimmed = value.strip()
        if not trimmed:
            raise serializers.ValidationError("Last name is required.")
        return trimmed

    def validate_email(self, value):
        normalized = value.strip().lower()
        if not normalized:
            raise serializers.ValidationError("Email address is required.")
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("An account with this email is already registered.")
        return normalized

    def validate_username(self, value):
        username = value.strip()
        if not re.match(r"^[\w.@+-]+$", username):
            raise serializers.ValidationError("Enter a valid username (letters, digits and @/./+/-/_ only).")
        return username

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("first_name", "").strip(),
            last_name=validated_data.get("last_name", "").strip(),
        )
        update_last_login(None, user)
        user.refresh_from_db()
        return user


class UpdateProfileSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=False)
    username = serializers.CharField(required=False)

    class Meta:
        model = User
        fields = ["username", "email", "first_name", "last_name"]

    def validate_email(self, value):
        normalized = value.strip().lower()
        user = self.context["request"].user
        if User.objects.filter(email__iexact=normalized).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("An account with this email is already registered.")
        return normalized

    def validate_username(self, value):
        username = value.strip()
        user = self.context["request"].user
        if not re.match(r"^[\w.@+-]+$", username):
            raise serializers.ValidationError("Enter a valid username (letters, digits and @/./+/-/_ only).")
        if User.objects.filter(username__iexact=username).exclude(pk=user.pk).exists():
            raise serializers.ValidationError("This username is already taken.")
        return username


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, min_length=6)

    def validate_current_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Current password is incorrect.")
        return value
